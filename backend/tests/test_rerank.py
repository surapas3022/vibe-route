from app.rerank import ranked_score, secondary_count, sort_candidates


def test_chiang_mai_mall_drops_below_community():
    mall = {
        "att_id": "mall",
        "province": "เชียงใหม่",
        "type_label": "ห้างสรรพสินค้า/แหล่งช้อปปิ้ง/ตลาดสด/ตลาดนัด/ถนนคนเดิน",
        "score_vector": 0.88,
    }
    community = {
        "att_id": "bridge",
        "province": "แม่ฮ่องสอน",
        "type_label": "วิถีชีวิตความเป็นอยู่ (ชุมชน)",
        "score_vector": 0.79,
    }
    ranked = sort_candidates([mall, community], prefer_secondary=True, limit=2)
    assert ranked[0]["att_id"] == "bridge"
    raw = sort_candidates([mall, community], prefer_secondary=False, limit=2)
    assert raw[0]["att_id"] == "mall"


def test_original_score_kept():
    row = {"province": "เชียงใหม่", "type_label": "หมู่บ้าน", "score_vector": 0.8}
    ranked = sort_candidates([row], prefer_secondary=True, limit=1)[0]
    assert ranked["score_vector"] == 0.8
    assert ranked["score_ranked"] == ranked_score(0.8, "เชียงใหม่", "หมู่บ้าน")


def test_named_place_outranks_higher_vector_score():
    winter = {
        "att_id": "huai",
        "name_th": "ห้วยจอกหลวง",
        "province": "แม่ฮ่องสอน",
        "score_vector": 0.95,
    }
    cave = {
        "att_id": "cave",
        "name_th": "ถ้ำน้ำบ่อผี",
        "province": "แม่ฮ่องสอน",
        "score_vector": 0.61,
    }
    ranked = sort_candidates(
        [winter, cave],
        prefer_secondary=True,
        limit=2,
        query="ถ้ำน้ำบ่อผี มีอะไรบ้าง",
    )
    assert ranked[0]["att_id"] == "cave"


def test_secondary_count():
    places = [{"province": "น่าน"}, {"province": "เชียงใหม่"}]
    assert secondary_count(places) == 1
