from __future__ import annotations

from app.intent import listing_matches, matched_intents
from app.rewrite import name_hit

CHIANG_MAI = "เชียงใหม่"

COMMUNITY_TYPES = (
    "วิถีชีวิตความเป็นอยู่ (ชุมชน)",
    "ชุมชนโบราณ/โบราณสถาน/โบราณวัตถุ",
    "ศูนย์การเรียนรู้ฯ (เกี่ยวกับกิจกรรม ผลิตภัณฑ์ และภูมิปัญญาในท้องถิ่น)",
    "หมู่บ้าน",
    "โครงการหลวง/โครงการพระราชดำริ",
)

MALL_TYPE = "ห้างสรรพสินค้า/แหล่งช้อปปิ้ง/ตลาดสด/ตลาดนัด/ถนนคนเดิน"

CHIANG_MAI_FACTOR = 0.72
MALL_FACTOR = 0.85
COMMUNITY_FACTOR = 1.15
SECONDARY_PROVINCE_FACTOR = 1.08
LIKE_ATT_FACTOR = 1.22
DISLIKE_ATT_FACTOR = 0.78
LIKE_TYPE_FACTOR = 1.1
CROWD_LIKE_STEP = 0.04
CROWD_LIKE_CAP = 1.15
CROWD_TYPE_FACTOR = 1.06
CROWD_DISLIKE_FACTOR = 0.94
VIBE_RUN = 5
ASK_PREFIXES = ("อยากได้", "อยากไป", "อยาก", "หาที่", "จะไป", "เอา")
SHARED_MARKERS = (
    "น้ำตก",
    "เดินป่า",
    "เทรล",
    "โฮมสเตย์",
    "กางเต็นท์",
    "แคมป์",
    "ทะเลหมอก",
    "ชุมชน",
    "อุทยาน",
    "หน้าหนาว",
    "กาแฟ",
    "ปะการัง",
    "ดำน้ำ",
    "ชายหาด",
)


def ranked_score(score_vector: float, province: str | None, type_label: str | None) -> float:
    score = float(score_vector)
    if province == CHIANG_MAI:
        score *= CHIANG_MAI_FACTOR
    else:
        score *= SECONDARY_PROVINCE_FACTOR
    if type_label == MALL_TYPE:
        score *= MALL_FACTOR
    if type_label in COMMUNITY_TYPES:
        score *= COMMUNITY_FACTOR
    return score


def _compact(text: str) -> str:
    return "".join((text or "").split()).casefold()


def _strip_ask(text: str) -> str:
    compact = _compact(text)
    for prefix in ASK_PREFIXES:
        if compact.startswith(prefix):
            return compact[len(prefix) :]
    return compact


def vibe_related(current: str, past: str) -> bool:
    now = _strip_ask(current)
    then = _strip_ask(past)
    if not now or not then:
        return False
    if now in then or then in now:
        return True
    current_keys = {item.key for item in matched_intents(current)}
    past_keys = {item.key for item in matched_intents(past)}
    if current_keys and current_keys & past_keys:
        return True
    if any(marker in now and marker in then for marker in SHARED_MARKERS):
        return True
    if len(now) < VIBE_RUN or len(then) < VIBE_RUN:
        return False
    shorter, longer = (now, then) if len(now) <= len(then) else (then, now)
    return any(shorter[index : index + VIBE_RUN] in longer for index in range(len(shorter) - VIBE_RUN + 1))


def secondary_focus(
    prefer_secondary: bool | None,
    province: str | None,
    places: list | None = None,
) -> bool:
    if (province or "").strip() == CHIANG_MAI:
        return False
    if not (province or "").strip() and places:
        found = {
            str(item.get("province") or "").strip()
            for item in places
            if isinstance(item, dict)
        }
        found.discard("")
        if found == {CHIANG_MAI}:
            return False
    if prefer_secondary is None:
        return True
    return bool(prefer_secondary)


def _in_lane(item: dict, *, focus: bool) -> bool:
    return bool(item.get("secondary_focus", True)) == focus


def vote_factor(row: dict, *, votes: list[dict], vibe: str, secondary_focus: bool) -> float:
    att_id = str(row.get("att_id") or "")
    ballots = [item for item in votes if _in_lane(item, focus=secondary_focus)]
    by_id = {str(item.get("att_id") or ""): item for item in ballots if item.get("att_id")}
    vote = by_id.get(att_id)
    if vote:
        rating = int(vote.get("rating") or 0)
        if rating > 0:
            return LIKE_ATT_FACTOR
        if rating < 0:
            return DISLIKE_ATT_FACTOR
    type_label = row.get("type_label")
    if not type_label:
        return 1.0
    for item in ballots:
        if int(item.get("rating") or 0) != 1:
            continue
        if item.get("type_label") != type_label:
            continue
        if vibe_related(vibe, str(item.get("vibe") or "")):
            return LIKE_TYPE_FACTOR
    return 1.0


def crowd_factor(row: dict, *, crowd: list[dict], vibe: str, secondary_focus: bool) -> float:
    att_id = str(row.get("att_id") or "")
    lane = [item for item in crowd if _in_lane(item, focus=secondary_focus)]
    by_id = {str(item.get("att_id") or ""): item for item in lane if item.get("att_id")}
    item = by_id.get(att_id)
    if item:
        likes = int(item.get("likes") or 0)
        dislikes = int(item.get("dislikes") or 0)
        net = likes - dislikes
        related = any(vibe_related(vibe, str(past)) for past in item.get("vibes") or [] if past)
        if related and net > 0:
            return min(CROWD_LIKE_CAP, 1.0 + CROWD_LIKE_STEP * net)
        if related and net < 0:
            return CROWD_DISLIKE_FACTOR
    type_label = row.get("type_label")
    if not type_label:
        return 1.0
    for item in lane:
        if item.get("type_label") != type_label:
            continue
        if int(item.get("likes") or 0) <= int(item.get("dislikes") or 0):
            continue
        if any(vibe_related(vibe, str(past)) for past in item.get("vibes") or [] if past):
            return CROWD_TYPE_FACTOR
    return 1.0


def sort_candidates(
    rows: list[dict],
    *,
    prefer_secondary: bool,
    limit: int = 6,
    query: str | None = None,
    vibe: str | None = None,
    votes: list[dict] | None = None,
    crowd: list[dict] | None = None,
    province: str | None = None,
) -> list[dict]:
    query_text = query or ""
    vibe_text = vibe or query_text
    intents = matched_intents(query_text)
    ballots = votes or []
    crowd_votes = crowd or []
    focus = secondary_focus(prefer_secondary, province)
    prepared = []
    for row in rows:
        vector = float(row.get("score_vector") or 0)
        ranked = ranked_score(vector, row.get("province"), row.get("type_label"))
        matched = listing_matches(row, intents)
        intent_hit = 1 if matched else 0
        if matched:
            ranked *= matched.boost
        score_ranked = ranked if prefer_secondary else vector
        score_ranked *= crowd_factor(row, crowd=crowd_votes, vibe=vibe_text, secondary_focus=focus)
        score_ranked *= vote_factor(row, votes=ballots, vibe=vibe_text, secondary_focus=focus)
        item = {
            **row,
            "score_vector": vector,
            "score_ranked": score_ranked,
            "name_hit": name_hit(query_text, row.get("name_th")),
            "intent_hit": intent_hit,
        }
        prepared.append(item)
    prepared.sort(key=lambda item: (item["name_hit"], item["intent_hit"], item["score_ranked"]), reverse=True)
    return prepared[:limit]


def secondary_count(places: list[dict]) -> int:
    return sum(1 for place in places if place.get("province") != CHIANG_MAI)
