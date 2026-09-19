from app.places import listing_to_place


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
