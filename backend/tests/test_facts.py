from app.facts import fee_field, hours_field, parse_location, usable_tel


def test_fee_zero_is_free():
    assert fee_field("0")["status"] == "confirmed"
    assert "ฟรี" in fee_field("0")["label"]


def test_fee_missing_is_unknown():
    assert fee_field(None)["status"] == "unknown"


def test_hours_placeholder_unknown():
    field = hours_field("วันและเวลาเปิด-ปิดทำการของสถานที่")
    assert field["status"] == "unknown"


def test_hours_kept_as_text():
    field = hours_field("ทุกวัน 06.00 - 18.00 น.")
    assert field["status"] == "confirmed"
    assert field["text"] == "ทุกวัน 06.00 - 18.00 น."


def test_location_drops_maps_url():
    assert parse_location("https://maps.app.goo.gl/abc") == (None, None)
    assert parse_location("18.78, 98.98")[0] == 18.78


def test_tel_dash_is_none():
    assert usable_tel("-") is None
    assert usable_tel("056 511 222") == "056 511 222"
