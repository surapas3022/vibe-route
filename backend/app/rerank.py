from __future__ import annotations

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


def sort_candidates(
    rows: list[dict],
    *,
    prefer_secondary: bool,
    limit: int = 6,
    query: str | None = None,
) -> list[dict]:
    prepared = []
    for row in rows:
        vector = float(row.get("score_vector") or 0)
        ranked = ranked_score(vector, row.get("province"), row.get("type_label"))
        item = {
            **row,
            "score_vector": vector,
            "score_ranked": ranked if prefer_secondary else vector,
            "name_hit": name_hit(query or "", row.get("name_th")),
        }
        prepared.append(item)
    key = "score_ranked" if prefer_secondary else "score_vector"
    prepared.sort(key=lambda item: (item["name_hit"], item[key]), reverse=True)
    return prepared[:limit]


def secondary_count(places: list[dict]) -> int:
    return sum(1 for place in places if place.get("province") != CHIANG_MAI)
