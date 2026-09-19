from __future__ import annotations

from typing import Any

from app import db, facts
from app.schemas import MapPoint, Place, PlaceImage


def listing_to_place(row: dict[str, Any], *, why: str, images: list[PlaceImage] | None = None) -> Place:
    tel = facts.usable_tel(row.get("tel"))
    fee = facts.fee_field(row.get("fee_th"), row.get("fee_kid"))
    hours = facts.hours_field(row.get("hours_raw"))
    lat = row.get("lat")
    lng = row.get("lng")
    return Place(
        att_id=row["att_id"],
        name_th=row["name_th"],
        province=row["province"],
        district=row.get("district"),
        type_label=row.get("type_label"),
        why=why,
        detail=facts.clean_text(row.get("detail_clean")),
        highlight=facts.clean_text(row.get("highlight")),
        score_vector=float(row.get("score_vector") or 0),
        score_ranked=float(row.get("score_ranked") or row.get("score_vector") or 0),
        fee=fee,
        hours=hours,
        tel=tel,
        website=facts.clean_text(row.get("website")),
        facebook=facts.clean_text(row.get("facebook")),
        limitation=facts.clean_text(row.get("limitation")),
        lat=lat,
        lng=lng,
        images=images or [],
    )


def pack_image(
    row: dict[str, Any],
    *,
    session_id: str,
    is_cover: bool,
    viewer_faved: bool,
) -> PlaceImage:
    return PlaceImage(
        id=row["id"],
        att_id=row["att_id"],
        url=row["public_url"],
        fav_count=int(row.get("fav_count") or 0),
        is_cover=is_cover,
        viewer_faved=viewer_faved,
        viewer_owned=row.get("uploader_session") == session_id,
        moderation_status=row.get("moderation_status") or "accepted",
    )


def map_points_for(places: list[Place]) -> list[MapPoint]:
    points = []
    for place in places:
        if place.lat is None or place.lng is None:
            continue
        points.append(
            MapPoint(
                att_id=place.att_id,
                name_th=place.name_th,
                lat=place.lat,
                lng=place.lng,
            )
        )
    return points


def load_images(att_ids: list[str], session_id: str) -> dict[str, list[PlaceImage]]:
    if not att_ids or not db.supabase_configured():
        return {att_id: [] for att_id in att_ids}
    client = db.get_supabase()
    result = (
        client.table("place_images")
        .select("*")
        .in_("att_id", att_ids)
        .eq("moderation_status", "accepted")
        .execute()
    )
    favs = set()
    if result.data:
        image_ids = [row["id"] for row in result.data]
        fav_rows = (
            client.table("image_favorites")
            .select("image_id")
            .eq("session_id", session_id)
            .in_("image_id", image_ids)
            .execute()
        )
        favs = {row["image_id"] for row in fav_rows.data or []}
    grouped: dict[str, list[dict[str, Any]]] = {att_id: [] for att_id in att_ids}
    for row in result.data or []:
        grouped.setdefault(row["att_id"], []).append(row)
    images: dict[str, list[PlaceImage]] = {}
    for att_id, rows in grouped.items():
        rows.sort(key=lambda item: (-int(item.get("fav_count") or 0), item.get("created_at") or ""))
        packed = []
        for index, row in enumerate(rows):
            try:
                packed.append(
                    pack_image(
                        row,
                        session_id=session_id,
                        is_cover=index == 0,
                        viewer_faved=row["id"] in favs,
                    )
                )
            except Exception:
                continue
        images[att_id] = packed
    return images


def attach_live_images(places: list[Place], session_id: str) -> list[Place]:
    if not places:
        return places
    try:
        loaded = load_images([place.att_id for place in places], session_id)
    except Exception:
        return places
    return [
        place.model_copy(update={"images": loaded.get(place.att_id, place.images)})
        for place in places
    ]
