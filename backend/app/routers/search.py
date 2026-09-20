from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app import db, facts, intent, llm, places as place_mod, rerank, rewrite
from app.config import get_settings
from app.embed import EmbedError, embed_gemini_text, embed_nvidia_text
from app.geo import NEARBY_KM, NEARBY_LIMIT, NEARBY_MAX_KM, NEARBY_WIDE_LIMIT, format_km
from app.privacy import mask_query
from app.regions import normalize_region
from app.deps import require_session
from app.schemas import NearbyResponse, Place, SearchRequest, SearchResponse

router = APIRouter()


def _fallback_intro(
    query: str,
    prefer_secondary: bool,
    empty: bool,
    *,
    followup: bool = False,
    focus_name: str | None = None,
    mismatch: str | None = None,
) -> str:
    if mismatch:
        return mismatch
    if empty:
        return "ไม่พบที่เที่ยวในภาคเหนือที่ตรงมู้ดนี้จากฐาน ททท."
    if focus_name:
        return f"{focus_name} จากฐาน ททท. ด้านล่างเป็นข้อมูลสถานที่นี้ และที่ใกล้เคียงในมู้ดเดิม"
    if followup:
        if prefer_secondary:
            return f"ค้นต่อตาม «{query}» จากฐาน ททท. ภาคเหนือ เน้นชุมชนและจังหวัดรอง"
        return f"ค้นต่อตาม «{query}» จากฐาน ททท. ภาคเหนือ เรียงตามความตรงมู้ด"
    if prefer_secondary:
        return f"ผลการค้นหาตามมู้ด «{query}» จากฐาน ททท. ภาคเหนือ เน้นชุมชนและจังหวัดรอง"
    return f"ผลการค้นหาตามมู้ด «{query}» จากฐาน ททท. ภาคเหนือ เรียงตามความตรงมู้ด"


def _save_message(
    *,
    session_id: str,
    chat_id: str,
    query: str,
    payload: SearchResponse,
    region: str | None = None,
    province: str | None = None,
) -> str:
    client = db.get_supabase()
    existing = client.table("chats").select("id").eq("id", chat_id).eq("session_id", session_id).execute()
    if not existing.data:
        client.table("chats").insert(
            {
                "id": chat_id,
                "session_id": session_id,
                "title": query[:80],
            }
        ).execute()
    row = {
        "query": query,
        "prefer_secondary": payload.prefer_secondary,
        "intro": payload.intro,
        "assistant": payload.assistant.model_dump(),
        "places": [item.model_dump() for item in payload.places],
        "map_points": [item.model_dump() for item in payload.map_points],
        "retrieval_query": payload.retrieval_query,
        "region": region,
        "province": province,
    }
    last = db.last_chat_message(chat_id, session_id)
    last_id = str(last["id"]) if last and str(last.get("query") or "").strip() == query.strip() else None
    return _write_message_row(client, chat_id=chat_id, message_id=payload.message_id, last_id=last_id, row=row)


def _write_message_row(
    client: Any,
    *,
    chat_id: str,
    message_id: str,
    last_id: str | None,
    row: dict[str, Any],
) -> str:
    extras = ("retrieval_query", "region", "province")
    stored = dict(row)
    while True:
        try:
            if last_id:
                client.table("messages").update(stored).eq("id", last_id).execute()
                return last_id
            client.table("messages").insert({"id": message_id, "chat_id": chat_id, **stored}).execute()
            return message_id
        except Exception:
            dropped = False
            for key in extras:
                if key in stored:
                    stored.pop(key)
                    dropped = True
                    break
            if not dropped:
                raise


def _can_explain() -> bool:
    settings = get_settings()
    return bool(settings.nvidia_key_list or settings.gemini_key_list)


def _pack_search(
    *,
    chat_id: str,
    message_id: str,
    intro: str,
    assistant: Any,
    prefer_secondary: bool,
    places: list[Place],
    map_points: list[Any],
    explain_pending: bool,
    retrieval_query: str | None = None,
) -> SearchResponse:
    return SearchResponse(
        chat_id=chat_id,
        message_id=message_id,
        intro=intro,
        assistant=assistant,
        prefer_secondary=prefer_secondary,
        secondary_count=rerank.secondary_count([place.model_dump() for place in places]),
        places=places,
        map_points=map_points,
        explain_pending=explain_pending,
        retrieval_query=retrieval_query,
    )


def _retrieval_query(
    query: str,
    *,
    chat_id: str | None,
    session_id: str,
    before_message_id: str | None = None,
) -> str:
    prior: list[str] = []
    if chat_id:
        try:
            prior = db.fetch_chat_queries(
                chat_id,
                session_id,
                before_message_id=before_message_id,
            )
        except Exception:
            prior = []
    return rewrite.retrieval_query(query, prior)


def _owned_message(message_id: str, session_id: str) -> dict[str, Any]:
    client = db.get_supabase()
    result = client.table("messages").select("*").eq("id", message_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อความ")
    row = result.data[0]
    chat = (
        client.table("chats")
        .select("id")
        .eq("id", row["chat_id"])
        .eq("session_id", session_id)
        .execute()
    )
    if not chat.data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อความ")
    return row


@router.post("/v1/search", response_model=SearchResponse)
async def search(body: SearchRequest, session_id: str = Depends(require_session)):
    settings = get_settings()
    region = normalize_region(body.region, default=settings.poc_region)
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")

    query = mask_query(body.query)
    retrieve_text = _retrieval_query(query, chat_id=body.chat_id, session_id=session_id)
    mismatch = None

    matches: list[dict[str, Any]] = []
    try:
        if settings.nvidia_key_list:
            try:
                vector = await embed_nvidia_text(retrieve_text, task_type="RETRIEVAL_QUERY", quick=True)
                matches = db.match_listings(
                    vector,
                    region=region,
                    province=body.province,
                    match_count=settings.retrieve_k,
                    backend="nvidia",
                )
            except (EmbedError, Exception):
                matches = []
        if not matches and settings.gemini_key_list:
            try:
                vector = await embed_gemini_text(retrieve_text, task_type="RETRIEVAL_QUERY", quick=True)
                matches = db.match_listings(
                    vector,
                    region=region,
                    province=body.province,
                    match_count=settings.retrieve_k,
                    backend="gemini",
                )
            except (EmbedError, Exception):
                matches = []
        if not matches:
            raise EmbedError("no vector matches")
    except EmbedError:
        try:
            matches = db.keyword_listings(
                retrieve_text,
                region=region,
                province=body.province,
                match_count=settings.retrieve_k,
            )
        except Exception:
            matches = []

    att_ids = [row["att_id"] for row in matches if row.get("att_id")]
    try:
        named = db.name_listings(
            query,
            region=region,
            province=body.province,
            match_count=settings.result_k,
        )
    except Exception:
        named = []
    named_ids = [row["att_id"] for row in named if row.get("att_id")]
    listings = {
        row["att_id"]: row
        for row in db.fetch_listings_by_ids(list(dict.fromkeys(att_ids + named_ids)))
    }
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in named + matches:
        att_id = row.get("att_id")
        if not att_id or att_id in seen:
            continue
        listing = listings.get(att_id) or (row if row.get("name_th") else None)
        if not listing:
            continue
        seen.add(att_id)
        merged.append({**listing, "score_vector": row.get("score_vector") or 0})

    votes: list[dict[str, Any]] = []
    crowd: list[dict[str, Any]] = []
    try:
        votes = db.fetch_session_votes(session_id)
    except Exception:
        votes = []
    try:
        crowd = db.region_trends(region).get("crowd") or []
    except Exception:
        crowd = []
    ranked = rerank.sort_candidates(
        merged,
        prefer_secondary=body.prefer_secondary,
        limit=settings.result_k,
        query=query,
        vibe=retrieve_text,
        votes=votes,
        crowd=crowd,
        province=body.province,
    )
    intents = intent.matched_intents(query) or intent.matched_intents(retrieve_text)
    if intent.requires_listing_match(intents):
        ranked = [row for row in ranked if row.get("intent_hit")]
        if not ranked:
            mismatch = intent.empty_intro(query, region, no_listing=True)
    else:
        ranked = [
            row
            for row in ranked
            if row.get("name_hit")
            or row.get("intent_hit")
            or float(row.get("score_vector") or 0) >= intent.MIN_VECTOR_SCORE
        ]
        if not ranked and merged:
            mismatch = (
                f"ไม่พบที่เที่ยวใน{region}ที่ตรงมู้ด «{query}» จากฐาน ททท. "
                "ผลที่ใกล้เคียงเกินไปจึงไม่แสดง"
            )
    built = []
    for row in ranked:
        built.append(
            place_mod.listing_to_place(
                row,
                why=facts.snippet_why(
                    row["name_th"],
                    row["province"],
                    row.get("type_label"),
                    row.get("detail_clean"),
                    limit=420 if rewrite.name_hit(query, row.get("name_th")) else 180,
                ),
            )
        )
    built = place_mod.attach_live_images(built, session_id)

    empty = not built
    focus_name = next(
        (row["name_th"] for row in ranked if rewrite.name_hit(query, row.get("name_th")) >= 2),
        None,
    )
    chat_id = body.chat_id or str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    response = _pack_search(
        chat_id=chat_id,
        message_id=message_id,
        intro=_fallback_intro(
            query,
            body.prefer_secondary,
            empty,
            followup=bool(body.chat_id),
            focus_name=focus_name,
            mismatch=mismatch,
        ),
        assistant=llm.health_assistant(),
        prefer_secondary=body.prefer_secondary,
        places=built,
        map_points=place_mod.map_points_for(built),
        explain_pending=bool(built) and _can_explain(),
        retrieval_query=retrieve_text,
    )
    try:
        saved_id = _save_message(
            session_id=session_id,
            chat_id=response.chat_id,
            query=query,
            payload=response,
            region=region,
            province=body.province,
        )
        if saved_id != response.message_id:
            response.message_id = saved_id
    except Exception:
        pass
    return response


@router.post("/v1/messages/{message_id}/explain", response_model=SearchResponse)
async def explain_message(message_id: str, session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    row = _owned_message(message_id, session_id)
    places = place_mod.attach_live_images(
        [Place.model_validate(item) for item in row.get("places") or []],
        session_id,
    )
    map_points = row.get("map_points") or []
    assistant = row.get("assistant") or llm.health_assistant().model_dump()
    prior: list[str] = []
    try:
        prior = db.fetch_chat_queries(
            str(row["chat_id"]),
            session_id,
            before_message_id=str(row["id"]),
        )
    except Exception:
        prior = []
    query_text = mask_query(str(row.get("query") or ""))
    prior = [mask_query(item) for item in prior]
    retrieve_text = rewrite.retrieval_query(query_text, prior)
    packed = _pack_search(
        chat_id=str(row["chat_id"]),
        message_id=str(row["id"]),
        intro=row.get("intro") or "",
        assistant=assistant,
        prefer_secondary=bool(row.get("prefer_secondary")),
        places=places,
        map_points=map_points,
        explain_pending=False,
        retrieval_query=retrieve_text,
    )
    if not places or not _can_explain():
        return packed

    listings = {
        item["att_id"]: item
        for item in db.fetch_listings_by_ids([place.att_id for place in places])
    }
    cards = []
    for place in places:
        listing = listings.get(place.att_id) or {}
        detail = listing.get("detail_clean") or ""
        clip = 480 if rewrite.name_hit(query_text, place.name_th) else 280
        cards.append(
            {
                "att_id": place.att_id,
                "name_th": place.name_th,
                "province": place.province,
                "type_label": place.type_label or listing.get("type_label"),
                "detail_clean": detail[:clip],
                "fee_on_card": place.fee.status == "confirmed",
                "hours_on_card": place.hours.status == "confirmed",
            }
        )
    try:
        intro, whys, assistant_status = await llm.explain_vibe(
            query_text,
            cards,
            prior=prior,
        )
    except Exception:
        return packed
    if assistant_status.level == "off":
        packed.assistant = llm.health_assistant()
        return packed
    if not intro and not whys:
        packed.assistant = assistant_status
        return packed

    updated = []
    for place in places:
        why = whys.get(place.att_id) or place.why
        updated.append(place.model_copy(update={"why": why}))
    packed = _pack_search(
        chat_id=str(row["chat_id"]),
        message_id=str(row["id"]),
        intro=intro or packed.intro,
        assistant=assistant_status,
        prefer_secondary=packed.prefer_secondary,
        places=updated,
        map_points=map_points,
        explain_pending=False,
        retrieval_query=retrieve_text,
    )
    try:
        db.get_supabase().table("messages").update(
            {
                "intro": packed.intro,
                "assistant": packed.assistant.model_dump(),
                "places": [item.model_dump() for item in packed.places],
            }
        ).eq("id", message_id).execute()
    except Exception:
        pass
    return packed


@router.get("/v1/places/{att_id}/nearby", response_model=NearbyResponse)
def nearby_places(
    att_id: str,
    session_id: str = Depends(require_session),
    km: float = Query(default=NEARBY_KM, ge=1, le=NEARBY_MAX_KM),
):
    settings = get_settings()
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    listings = db.fetch_listings_by_ids([att_id])
    if not listings:
        raise HTTPException(status_code=404, detail="ไม่พบสถานที่")
    origin_row = listings[0]
    origin = place_mod.listing_to_place(
        origin_row,
        why=facts.snippet_why(
            origin_row["name_th"],
            origin_row["province"],
            origin_row.get("type_label"),
            origin_row.get("detail_clean"),
        ),
    )
    lat = origin.lat
    lng = origin.lng
    if lat is None or lng is None:
        origin = place_mod.attach_live_images([origin], session_id)[0]
        return NearbyResponse(origin=origin, km=km, places=[], map_points=[])

    region = origin_row.get("region") or settings.poc_region
    rows = db.nearby_listings(
        lat,
        lng,
        km=km,
        region=region,
        exclude_att_id=att_id,
        match_count=NEARBY_WIDE_LIMIT if km > NEARBY_KM else NEARBY_LIMIT,
    )
    built = []
    for row in rows:
        dist = float(row.get("distance_km") or 0)
        place = place_mod.listing_to_place(
            row,
            why=f"ห่างจาก{origin.name_th} {format_km(dist)} กม. ตามพิกัดในฐาน ททท.",
        )
        built.append(place.model_copy(update={"distance_km": round(dist, 1)}))
    built = place_mod.attach_live_images(built, session_id)
    origin = place_mod.attach_live_images([origin], session_id)[0]
    return NearbyResponse(
        origin=origin,
        km=km,
        places=built,
        map_points=place_mod.map_points_for([origin], kind="origin")
        + place_mod.map_points_for(built, kind="nearby"),
    )
