from __future__ import annotations

from app.privacy import mask_query
from app.rerank import secondary_focus

TREND_DAYS = 14
TREND_PLACE_LIMIT = 6
TREND_QUERY_LIMIT = 8
MIN_QUERY_KEY = 6
LABEL_LEN = 28


def _compact(text: str) -> str:
    return "".join((text or "").split()).casefold()


def clip_label(text: str, limit: int = LABEL_LEN) -> str:
    clean = " ".join((text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: limit - 1].rstrip() + "…"


def pack_crowd(
    *,
    region: str,
    feedback: list[dict],
    messages: dict[str, dict],
    listings: dict[str, dict],
) -> list[dict]:
    buckets: dict[str, dict] = {}
    for row in feedback:
        att_id = str(row.get("att_id") or "")
        listing = listings.get(att_id) or {}
        if not att_id or listing.get("region") != region:
            continue
        message = messages.get(str(row.get("message_id") or ""), {})
        focus = secondary_focus(
            message.get("prefer_secondary"),
            message.get("province"),
            message.get("places"),
        )
        bucket = buckets.setdefault(
            f"{att_id}:{int(focus)}",
            {
                "att_id": att_id,
                "name_th": listing.get("name_th") or "",
                "province": listing.get("province") or "",
                "type_label": listing.get("type_label"),
                "likes": 0,
                "dislikes": 0,
                "vibes": [],
                "secondary_focus": focus,
            },
        )
        rating = int(row.get("rating") or 0)
        if rating > 0:
            bucket["likes"] += 1
        elif rating < 0:
            bucket["dislikes"] += 1
        vibe = str(message.get("retrieval_query") or message.get("query") or "").strip()
        if vibe:
            masked = mask_query(vibe)
            if masked and masked not in bucket["vibes"]:
                bucket["vibes"].append(masked)
    return list(buckets.values())


def pack_queries(texts: list[str], *, limit: int = TREND_QUERY_LIMIT) -> list[dict]:
    counts: dict[str, dict] = {}
    for raw in texts:
        masked = mask_query(" ".join((raw or "").split()))
        key = _compact(masked)
        if len(key) < MIN_QUERY_KEY:
            continue
        slot = counts.get(key)
        if slot is None:
            counts[key] = {"query": masked, "count": 1, "label": clip_label(masked)}
            continue
        slot["count"] += 1
        if len(masked) < len(slot["query"]):
            slot["query"] = masked
            slot["label"] = clip_label(masked)
    ranked = sorted(counts.values(), key=lambda item: (-item["count"], item["query"]))
    return ranked[:limit]


def pack_places(crowd: list[dict], *, limit: int = TREND_PLACE_LIMIT) -> list[dict]:
    merged: dict[str, dict] = {}
    for item in crowd:
        att_id = str(item.get("att_id") or "")
        if not att_id or not item.get("name_th"):
            continue
        slot = merged.setdefault(
            att_id,
            {
                "att_id": att_id,
                "name_th": item["name_th"],
                "province": item.get("province") or "",
                "type_label": item.get("type_label"),
                "likes": 0,
                "dislikes": 0,
            },
        )
        slot["likes"] += int(item.get("likes") or 0)
        slot["dislikes"] += int(item.get("dislikes") or 0)
    liked = [
        item
        for item in merged.values()
        if int(item.get("likes") or 0) > int(item.get("dislikes") or 0)
    ]
    liked.sort(key=lambda item: (-int(item["likes"]), -int(item["likes"]) + int(item["dislikes"]), item["name_th"]))
    out = []
    for item in liked[:limit]:
        out.append(
            {
                "att_id": item["att_id"],
                "name_th": item["name_th"],
                "province": item.get("province") or "",
                "type_label": item.get("type_label"),
                "likes": int(item["likes"]),
            }
        )
    return out
