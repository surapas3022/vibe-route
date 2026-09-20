from app.places import listing_to_place, map_points_for


def test_listing_includes_tat_detail():
    place = listing_to_place(
        {
            "att_id": "A1",
            "name_th": "ดอยอินทนนท์",
            "province": "เชียงใหม่",
            "district": "จอมทอง",
            "type_label": "อุทยานแห่งชาติ",
            "detail_clean": "ยอดเขาที่สูงที่สุดในประเทศไทย มีอากาศหนาวตลอดปี",
            "highlight": "ทะเลหมอกยามเช้า",
            "fee_th": "300",
            "fee_kid": "50",
            "hours_raw": "05:00 - 18:00",
            "tel": "053 286 729",
            "website": "https://example.test",
            "facebook": None,
            "limitation": None,
            "lat": 18.58,
            "lng": 98.48,
        },
        why="อากาศหนาว เหมาะกับคนอยากหนีความวุ่นวาย",
    )
    assert place.detail.startswith("ยอดเขา")
    assert place.highlight == "ทะเลหมอกยามเช้า"
    assert place.hours.text == "05:00 - 18:00"
    assert "300" in place.fee.label


def test_listing_website_without_scheme_is_absolute():
    """TAT often stores www.example.com. A relative href opens our own SPA."""
    place = listing_to_place(
        {
            "att_id": "A2",
            "name_th": "โฮมสเตย์บ้านกลาง",
            "province": "เชียงราย",
            "district": "แม่ฟ้าหลวง",
            "type_label": "วิถีชีวิตความเป็นอยู่ (ชุมชน)",
            "detail_clean": "บ้านกลางโฮมสเตย์",
            "highlight": None,
            "fee_th": None,
            "hours_raw": None,
            "tel": None,
            "website": "www.homestaybaanklang.test",
            "facebook": "HomestayBaanklang",
            "limitation": None,
            "lat": 20.05,
            "lng": 99.73,
        },
        why="ชุมชนบนดอย",
    )
    assert place.website == "https://www.homestaybaanklang.test"
    assert place.facebook == "https://www.facebook.com/HomestayBaanklang"


def test_pack_image_marks_owner():
    from app.places import pack_image

    row = {
        "id": "img-1",
        "att_id": "A1",
        "public_url": "https://example.test/a.jpg",
        "fav_count": 2,
        "uploader_session": "user-1",
        "moderation_status": "accepted",
    }
    owned = pack_image(row, session_id="user-1", is_cover=True, viewer_faved=False)
    other = pack_image(row, session_id="user-2", is_cover=False, viewer_faved=True)
    assert owned.viewer_owned is True
    assert owned.is_cover is True
    assert other.viewer_owned is False
    assert other.viewer_faved is True


def test_map_points_mark_nearby_kind_and_distance():
    place = listing_to_place(
        {
            "att_id": "N1",
            "name_th": "น้ำตกใกล้บ้าน",
            "province": "น่าน",
            "district": "ปัว",
            "type_label": "น้ำตก",
            "detail_clean": None,
            "highlight": None,
            "fee_th": None,
            "hours_raw": None,
            "tel": None,
            "website": None,
            "facebook": None,
            "limitation": None,
            "lat": 19.16,
            "lng": 100.91,
        },
        why="ใกล้จุดเริ่ม",
    )
    place = place.model_copy(update={"distance_km": 4.2})
    points = map_points_for([place], kind="nearby")
    assert points[0].kind == "nearby"
    assert points[0].distance_km == 4.2
