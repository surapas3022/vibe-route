from app.rerank import ranked_score, secondary_count, secondary_focus, sort_candidates


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


def test_liked_listing_outranks_higher_vector():
    weak = {
        "att_id": "liked",
        "name_th": "บ้านที่ถูกใจ",
        "province": "น่าน",
        "type_label": "หมู่บ้าน",
        "score_vector": 0.78,
    }
    strong = {
        "att_id": "other",
        "name_th": "จุดชมวิวใกล้เคียง",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.9,
    }
    ranked = sort_candidates(
        [strong, weak],
        prefer_secondary=True,
        limit=2,
        query="อยากไปชุมชนเงียบๆ",
        votes=[{"att_id": "liked", "rating": 1, "vibe": "อยากไปชุมชนเงียบๆ", "type_label": "หมู่บ้าน"}],
    )
    assert ranked[0]["att_id"] == "liked"
    assert ranked[0]["score_vector"] == 0.78
    assert ranked[0]["score_ranked"] > ranked[1]["score_ranked"]


def test_disliked_listing_drops_below_peer():
    disliked = {
        "att_id": "nope",
        "name_th": "ตลาดที่ไม่ถูกใจ",
        "province": "น่าน",
        "type_label": "ห้างสรรพสินค้า/แหล่งช้อปปิ้ง/ตลาดสด/ตลาดนัด/ถนนคนเดิน",
        "score_vector": 0.92,
    }
    peer = {
        "att_id": "ok",
        "name_th": "ตลาดอีกแห่ง",
        "province": "น่าน",
        "type_label": "ห้างสรรพสินค้า/แหล่งช้อปปิ้ง/ตลาดสด/ตลาดนัด/ถนนคนเดิน",
        "score_vector": 0.8,
    }
    ranked = sort_candidates(
        [disliked, peer],
        prefer_secondary=True,
        limit=2,
        query="อยากเดินตลาด",
        votes=[{"att_id": "nope", "rating": -1, "vibe": "อยากเดินตลาด", "type_label": disliked["type_label"]}],
    )
    assert ranked[0]["att_id"] == "ok"
    assert disliked["score_vector"] == 0.92


def test_liked_type_boosts_only_when_vibe_matches():
    park = {
        "att_id": "park-b",
        "name_th": "อุทยานแห่งชาติแม่วาง",
        "province": "น่าน",
        "type_label": "อุทยานแห่งชาติ",
        "score_vector": 0.68,
    }
    village = {
        "att_id": "view",
        "name_th": "จุดชมวิวดอยวาว",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.7,
    }
    votes = [
        {
            "att_id": "park-a",
            "rating": 1,
            "vibe": "อยากเดินป่า",
            "type_label": "อุทยานแห่งชาติ",
        }
    ]
    related = sort_candidates(
        [village, park],
        prefer_secondary=True,
        limit=2,
        query="หาที่เดินป่า",
        vibe="อยากเดินป่า หาที่เดินป่า",
        votes=votes,
    )
    assert related[0]["att_id"] == "park-b"
    unrelated = sort_candidates(
        [village, park],
        prefer_secondary=True,
        limit=2,
        query="อยากได้ที่พักโฮมสเตย์",
        vibe="อยากได้ที่พักโฮมสเตย์",
        votes=votes,
    )
    assert unrelated[0]["att_id"] == "view"


def test_lodging_query_prefers_homestay():
    cave = {
        "att_id": "cave",
        "name_th": "ถ้ำน้ำบ่อผี",
        "province": "น่าน",
        "score_vector": 0.9,
    }
    stay = {
        "att_id": "stay",
        "name_th": "โฮมสเตย์ศิลาเพชร",
        "province": "น่าน",
        "score_vector": 0.61,
    }
    ranked = sort_candidates(
        [cave, stay],
        prefer_secondary=True,
        limit=2,
        query="ชุมชนศิลาเพชร โฮมสเตย์ ที่พักชุมชน แนะนำหน่อย",
    )
    assert ranked[0]["att_id"] == "stay"


def test_crowd_likes_in_region_help_everyone():
    quiet = {
        "att_id": "quiet",
        "name_th": "จุดชมวิวที่คนถูกใจ",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.7,
    }
    other = {
        "att_id": "view",
        "name_th": "จุดชมวิวดอยวาว",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.74,
    }
    crowd = [
        {
            "att_id": "quiet",
            "likes": 8,
            "dislikes": 0,
            "type_label": "จุดชมวิว",
            "vibes": ["อยากได้น้ำตกเดินป่า"],
        }
    ]
    ranked = sort_candidates(
        [other, quiet],
        prefer_secondary=True,
        limit=2,
        query="หาที่เดินป่า น้ำตก",
        crowd=crowd,
    )
    assert ranked[0]["att_id"] == "quiet"
    assert ranked[0]["score_vector"] == 0.7
    unrelated = sort_candidates(
        [other, quiet],
        prefer_secondary=True,
        limit=2,
        query="อยากได้ที่พักโฮมสเตย์",
        crowd=crowd,
    )
    assert unrelated[0]["att_id"] == "view"


def test_chiang_mai_filter_is_main_city_lane():
    assert secondary_focus(True, "เชียงใหม่") is False
    assert secondary_focus(False, None) is False
    assert secondary_focus(True, None) is True
    assert secondary_focus(True, "น่าน") is True
    assert secondary_focus(True, None, places=[{"province": "เชียงใหม่"}, {"province": "เชียงใหม่"}]) is False
    assert secondary_focus(True, None, places=[{"province": "เชียงใหม่"}, {"province": "น่าน"}]) is True


def test_main_city_like_does_not_boost_secondary_search():
    liked = {
        "att_id": "doi",
        "name_th": "ดอยหัวหมู",
        "province": "เชียงใหม่",
        "type_label": "จุดชมวิว",
        "score_vector": 0.7,
    }
    other = {
        "att_id": "nan",
        "name_th": "จุดชมวิวน่าน",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.74,
    }
    votes = [{"att_id": "doi", "rating": 1, "vibe": "อยากเดินป่า", "type_label": "จุดชมวิว", "secondary_focus": False}]
    ranked = sort_candidates(
        [liked, other],
        prefer_secondary=True,
        limit=2,
        query="อยากเดินป่า",
        votes=votes,
    )
    assert ranked[0]["att_id"] == "nan"


def test_secondary_like_does_not_boost_chiang_mai_search():
    liked = {
        "att_id": "village",
        "name_th": "บ้านแม่ตะละเหนือ",
        "province": "เชียงใหม่",
        "type_label": "หมู่บ้าน",
        "score_vector": 0.7,
    }
    other = {
        "att_id": "view",
        "name_th": "ดอยหัวหมู",
        "province": "เชียงใหม่",
        "type_label": "จุดชมวิว",
        "score_vector": 0.74,
    }
    votes = [{"att_id": "village", "rating": 1, "vibe": "อยากเดินป่า", "type_label": "หมู่บ้าน", "secondary_focus": True}]
    ranked = sort_candidates(
        [other, liked],
        prefer_secondary=True,
        province="เชียงใหม่",
        limit=2,
        query="อยากเดินป่า",
        votes=votes,
    )
    assert ranked[0]["att_id"] == "view"


def test_main_city_like_boosts_chiang_mai_search():
    liked = {
        "att_id": "doi",
        "name_th": "ดอยหัวหมู",
        "province": "เชียงใหม่",
        "type_label": "จุดชมวิว",
        "score_vector": 0.7,
    }
    other = {
        "att_id": "view",
        "name_th": "จุดชมวิวอีกแห่ง",
        "province": "เชียงใหม่",
        "type_label": "น้ำตก",
        "score_vector": 0.82,
    }
    votes = [{"att_id": "doi", "rating": 1, "vibe": "อยากเดินป่า", "type_label": "จุดชมวิว", "secondary_focus": False}]
    ranked = sort_candidates(
        [other, liked],
        prefer_secondary=True,
        province="เชียงใหม่",
        limit=2,
        query="อยากเดินป่า",
        votes=votes,
    )
    assert ranked[0]["att_id"] == "doi"


def test_crowd_likes_stay_in_their_lane():
    quiet = {
        "att_id": "quiet",
        "name_th": "จุดชมวิวที่คนถูกใจ",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.7,
    }
    other = {
        "att_id": "view",
        "name_th": "จุดชมวิวดอยวาว",
        "province": "น่าน",
        "type_label": "จุดชมวิว",
        "score_vector": 0.74,
    }
    crowd = [
        {
            "att_id": "quiet",
            "likes": 8,
            "dislikes": 0,
            "type_label": "จุดชมวิว",
            "vibes": ["อยากได้น้ำตกเดินป่า"],
            "secondary_focus": False,
        }
    ]
    ranked = sort_candidates(
        [other, quiet],
        prefer_secondary=True,
        limit=2,
        query="หาที่เดินป่า น้ำตก",
        crowd=crowd,
    )
    assert ranked[0]["att_id"] == "view"
