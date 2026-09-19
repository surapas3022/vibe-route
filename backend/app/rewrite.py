from __future__ import annotations

RECENT_FOLLOWUPS = 3

ASK_TAILS = (
    "มีอะไรบ้าง",
    "เป็นยังไง",
    "น่าไปไหม",
    "อยู่ไหน",
    "แนะนำหน่อย",
    "ดีไหม",
    "เที่ยวยังไง",
)
ASK_PREFIXES = ("จะไป", "อยากไป", "เอา", "ไปที่", "ไป")
PLACE_MARKERS = ("ถ้ำ", "ดอย", "น้ำตก", "ห้วย", "วัด", "อุทยาน", "หมู่บ้าน", "กิ่ว", "ปาง", "สัน", "ผา")


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def named_needles(query: str) -> list[str]:
    text = _clean(query)
    found: list[str] = []
    seen: set[str] = set()

    def add(item: str) -> None:
        item = _clean(item)
        if len(item) < 3 or item in seen:
            return
        seen.add(item)
        found.append(item)

    add(text)
    for tail in ASK_TAILS:
        if tail in text:
            add(text.replace(tail, ""))
    for prefix in ASK_PREFIXES:
        if text.startswith(prefix):
            add(text[len(prefix) :])
    for part in text.split():
        add(part)
    return found


def is_specific_place_query(query: str) -> bool:
    text = _clean(query)
    if not text:
        return False
    if any(tail in text for tail in ASK_TAILS):
        return True
    if len(text) <= 48 and any(marker in text for marker in PLACE_MARKERS):
        return True
    return False


def name_hit(query: str, name_th: str | None) -> int:
    needle_query = _clean(query).replace(" ", "")
    name = _clean(name_th or "").replace(" ", "")
    if len(name) < 3:
        return 0
    if name in needle_query:
        return 2
    for needle in named_needles(query):
        compact = needle.replace(" ", "")
        if len(compact) < 3:
            continue
        if compact in name or name in compact:
            return 1
    return 0


def retrieval_query(current: str, prior: list[str]) -> str:
    """Turn a follow-up plus earlier turns into one standalone retrieval query.

    Named-place questions stay as typed so the original vibe cannot bury the
    place the traveler just asked about.
    """
    current_text = _clean(current)
    history = [_clean(item) for item in prior if _clean(item)]
    if not current_text:
        return " ".join(history)
    if not history:
        return current_text
    if is_specific_place_query(current_text):
        return current_text

    first = history[0]
    recent = [item for item in history[1:][-RECENT_FOLLOWUPS:] if item]
    parts: list[str] = []
    for item in [first, *recent, current_text]:
        if item and item not in parts:
            parts.append(item)
    return " ".join(parts)
