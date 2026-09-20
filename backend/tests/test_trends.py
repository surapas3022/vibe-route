from app.trends import pack_crowd, pack_places, pack_queries


def test_pack_crowd_keeps_only_that_region():
    crowd = pack_crowd(
        region="ภาคเหนือ",
        feedback=[
            {"att_id": "north-park", "rating": 1, "message_id": "m1"},
            {"att_id": "north-park", "rating": 1, "message_id": "m2"},
            {"att_id": "south-reef", "rating": 1, "message_id": "m3"},
            {"att_id": "north-park", "rating": -1, "message_id": "m4"},
        ],
        messages={
            "m1": {"query": "อยากเดินป่า"},
            "m2": {"retrieval_query": "อยากเดินป่า น้ำตก", "query": "น้ำตก"},
            "m3": {"query": "ดำน้ำดูปะการัง"},
        },
        listings={
            "north-park": {
                "name_th": "อุทยานแห่งชาติดอยอินทนนท์",
                "province": "เชียงใหม่",
                "region": "ภาคเหนือ",
                "type_label": "อุทยานแห่งชาติ",
            },
            "south-reef": {
                "name_th": "จุดดำน้ำเกาะหิน",
                "province": "กระบี่",
                "region": "ภาคใต้",
                "type_label": "ชายหาด",
            },
        },
    )
    assert [item["att_id"] for item in crowd] == ["north-park"]
    assert crowd[0]["likes"] == 2
    assert crowd[0]["dislikes"] == 1
    assert "อยากเดินป่า" in crowd[0]["vibes"]


def test_pack_crowd_splits_main_and_secondary_likes():
    crowd = pack_crowd(
        region="ภาคเหนือ",
        feedback=[
            {"att_id": "doi", "rating": 1, "message_id": "m-main"},
            {"att_id": "doi", "rating": 1, "message_id": "m-secondary"},
        ],
        messages={
            "m-main": {"query": "อยากเดินป่า", "prefer_secondary": True, "province": "เชียงใหม่"},
            "m-secondary": {"query": "อยากเดินป่า", "prefer_secondary": True, "province": None},
        },
        listings={
            "doi": {
                "name_th": "ดอยหัวหมู",
                "province": "เชียงใหม่",
                "region": "ภาคเหนือ",
                "type_label": "จุดชมวิว",
            },
        },
    )
    by_lane = {item["secondary_focus"]: item for item in crowd}
    assert by_lane[False]["likes"] == 1
    assert by_lane[True]["likes"] == 1


def test_pack_places_hides_net_disliked():
    crowd = [
        {"att_id": "a", "name_th": "น้ำตกแม่ยะ", "province": "เชียงใหม่", "likes": 4, "dislikes": 1},
        {"att_id": "b", "name_th": "ห้าง", "province": "เชียงใหม่", "likes": 1, "dislikes": 3},
    ]
    places = pack_places(crowd)
    assert [item["att_id"] for item in places] == ["a"]
    assert places[0]["likes"] == 4


def test_pack_queries_masks_pii_and_counts():
    rows = pack_queries(
        [
            "อยากเดินป่า น้ำตก",
            "อยากเดินป่า น้ำตก",
            "อยากเดินป่า โทร 0812345678",
            "ดำน้ำ",
        ]
    )
    keys = [item["query"] for item in rows]
    assert keys[0] == "อยากเดินป่า น้ำตก"
    assert rows[0]["count"] == 2
    assert all("0812345678" not in item["query"] for item in rows)
    assert all(item["query"] != "ดำน้ำ" for item in rows)
