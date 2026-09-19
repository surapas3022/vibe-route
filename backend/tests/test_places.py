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
