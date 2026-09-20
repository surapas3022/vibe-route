from app.intent import empty_intro, listing_matches, matched_intents, requires_listing_match
from app.rerank import sort_candidates


def test_sea_intent_is_detected():
    query = "อยากดำน้ำดูปะการัง"
    intents = matched_intents(query)
    assert [item.key for item in intents] == ["sea"]
    assert requires_listing_match(intents)
    text = empty_intro(query, "ภาคเหนือ", no_listing=True)
    assert text and "ปะการัง" in text
    assert "ภาคเหนือ" in text
    assert "เปลี่ยนภาค" in text


def test_sea_mist_is_not_a_sea_intent():
    assert matched_intents("อยากไปทะเลหมอก") == []


def test_sea_keeps_coral_listing_in_any_region():
    waterfall = {
        "att_id": "fall",
        "name_th": "น้ำตกแม่ยะ",
        "province": "เชียงใหม่",
        "detail_clean": "น้ำตกในป่าดอย",
        "score_vector": 0.91,
    }
    reef = {
        "att_id": "reef",
        "name_th": "จุดดำน้ำเกาะหิน",
        "province": "กระบี่",
        "detail_clean": "จุดดำน้ำดูปะการังน้ำตื้น",
        "score_vector": 0.55,
    }
    ranked = sort_candidates(
        [waterfall, reef],
        prefer_secondary=True,
        limit=2,
        query="อยากดำน้ำดูปะการัง",
    )
    kept = [row for row in ranked if row.get("intent_hit")]
    assert [row["att_id"] for row in kept] == ["reef"]
    assert listing_matches(reef, matched_intents("อยากดำน้ำดูปะการัง")) is not None
    assert listing_matches(waterfall, matched_intents("อยากดำน้ำดูปะการัง")) is None


def test_trail_and_camp_intents():
    assert [item.key for item in matched_intents("หาที่วิ่ง trail")] == ["trail"]
    assert [item.key for item in matched_intents("อยากได้ที่ตั้งแคมป์ กางเต็นท์")] == ["camp"]


def test_trail_query_prefers_park_with_trail_text():
    market = {
        "att_id": "market",
        "name_th": "ตลาดชุมชน",
        "province": "น่าน",
        "type_label": "ห้างสรรพสินค้า/แหล่งช้อปปิ้ง/ตลาดสด/ตลาดนัด/ถนนคนเดิน",
        "score_vector": 0.9,
    }
    park = {
        "att_id": "park",
        "name_th": "อุทยานแห่งชาติดอยอินทนนท์",
        "province": "เชียงใหม่",
        "type_label": "อุทยานแห่งชาติ",
        "detail_clean": "มีเส้นทางเดินป่าและวิ่งเทรล",
        "score_vector": 0.6,
    }
    ranked = sort_candidates(
        [market, park],
        prefer_secondary=True,
        limit=2,
        query="หาที่วิ่ง trail",
    )
    assert ranked[0]["att_id"] == "park"
    assert ranked[0]["intent_hit"] == 1
