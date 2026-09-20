from __future__ import annotations

import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class Intent:
    key: str
    label: str
    needles: tuple[str, ...]
    listing_needles: tuple[str, ...] = ()
    type_needles: tuple[str, ...] = ()
    require_listing_match: bool = False
    boost: float = 1.18


SEA = Intent(
    key="sea",
    label="ดำน้ำ ดูปะการัง หรือเที่ยวทะเล",
    needles=(
        "ดำน้ำ",
        "ดูปะการัง",
        "ปะการัง",
        "สนอร์เกิล",
        "snorkel",
        "scuba",
        "diving",
        "dive",
        "reef",
        "ชายหาด",
        "เกาะแก้ว",
        "เที่ยวทะเล",
        "ไปทะเล",
        "เล่นน้ำทะเล",
        "น้ำทะเล",
    ),
    listing_needles=("ปะการัง", "ดำน้ำ", "ชายหาด", "สนอร์เกิล", "น้ำทะเล"),
    require_listing_match=True,
)

TRAIL = Intent(
    key="trail",
    label="วิ่งเทรล หรือเดินป่า",
    needles=("trail", "เทรล", "วิ่งเทรล", "เดินป่า", "trekking", "hiking", "แบกเป้", "เส้นทางเดิน"),
    listing_needles=("เดินป่า", "เทรล", "เส้นทาง", "trekking", "hiking", "trail"),
    type_needles=("อุทยาน", "น้ำตก", "จุดชมวิว", "ดอย"),
    boost=1.2,
)

CAMP = Intent(
    key="camp",
    label="กางเต็นท์ หรือตั้งแคมป์",
    needles=("กางเต็นท์", "ลานแคมป์", "ลานกาง", "camping", "แคมป์ปิ้ง", "นอนเต็นท์", "ตั้งแคมป์"),
    listing_needles=("กางเต็นท์", "ลานแคมป์", "ลานกาง", "แคมป์ปิ้ง", "เต็นท์", "camping"),
    require_listing_match=True,
    boost=1.22,
)

LODGING = Intent(
    key="lodging",
    label="ที่พัก",
    needles=("ที่พัก", "โฮมสเตย์", "ค้างคืน", "โรงแรม", "รีสอร์ท"),
    listing_needles=("โฮมสเตย์", "ที่พัก", "รีสอร์ท", "โรงแรม"),
    boost=1.22,
)

FOOD = Intent(
    key="food",
    label="ของกินหรือตลาด",
    needles=("ของกิน", "อาหาร", "กินอะไร", "ตลาด"),
    listing_needles=("ตลาด", "อาหาร", "ของกิน"),
    type_needles=("ห้างสรรพสินค้า/แหล่งช้อปปิ้ง/ตลาดสด/ตลาดนัด/ถนนคนเดิน",),
    boost=1.18,
)

INTENTS = (SEA, TRAIL, CAMP, LODGING, FOOD)
MIN_VECTOR_SCORE = 0.42


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def _blob(text: str) -> str:
    cleaned = unicodedata.normalize("NFC", _clean(text))
    if "ทะเลหมอก" in cleaned:
        cleaned = cleaned.replace("ทะเลหมอก", " ")
    return cleaned.casefold()


def matched_intents(query: str) -> list[Intent]:
    blob = _blob(query)
    if not blob:
        return []
    found: list[Intent] = []
    for item in INTENTS:
        if any(needle.casefold() in blob for needle in item.needles):
            found.append(item)
    return found


def listing_matches(row: dict, intents: list[Intent]) -> Intent | None:
    if not intents:
        return None
    type_label = str(row.get("type_label") or "")
    blob = " ".join(
        str(row.get(key) or "")
        for key in ("name_th", "type_label", "detail_clean", "search_text")
    )
    for item in intents:
        if any(needle in blob for needle in item.listing_needles):
            return item
        if any(needle in type_label for needle in item.type_needles):
            return item
    return None


def requires_listing_match(intents: list[Intent]) -> bool:
    return any(item.require_listing_match for item in intents)


def empty_intro(query: str, region: str, *, no_listing: bool = False) -> str | None:
    intents = matched_intents(query)
    if no_listing and intents:
        labels = " / ".join(item.label for item in intents)
        return (
            f"ใน{region}ยังไม่พบสถานที่ที่ข้อความ ททท. ตรงกับ{labels} "
            "ถ้ามีข้อมูลในภาคอื่น ให้เปลี่ยนภาคแล้วค้นคำเดิมอีกครั้ง"
        )
    return None
