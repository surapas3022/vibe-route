from app.tat import prepare_row


def _base(**overrides):
    row = {
        "ATT_ID": "20211115145426731761",
        "STATUS_DATA": 1,
        "ATT_NAME_TH": "สะพานขัวตะเคียน",
        "REGION_NAME_TH": "ภาคเหนือ",
        "ATT_DETAIL_TH": "สะพานไม้ในชุมชน",
        "PROVINCE_NAME_TH": "แม่ฮ่องสอน",
        "ATT_TYPE_LABEL": "วิถีชีวิตความเป็นอยู่ (ชุมชน)",
        "ATT_LOCATION": "18.78, 98.98",
        "ATT_FEE_TH": "0",
        "ATT_TEL": "-",
    }
    row.update(overrides)
    return row


def test_prepare_skips_inactive():
    assert prepare_row(_base(STATUS_DATA=0), "ภาคเหนือ") is None


def test_prepare_keeps_active_north():
    row = prepare_row(_base(), "ภาคเหนือ")
    assert row is not None
    assert row["att_id"] == "20211115145426731761"
    assert "att_id" not in row["embed_text"]
    assert row["tel"] is None


def test_prepare_skips_other_region():
    assert prepare_row(_base(REGION_NAME_TH="ภาคอีสาน"), "ภาคเหนือ") is None


def test_prepare_absolutizes_website_without_scheme():
    row = prepare_row(_base(ATT_WEBSITE="www.homestaybaanklang.test"), "ภาคเหนือ")
    assert row is not None
    assert row["website"] == "https://www.homestaybaanklang.test"
