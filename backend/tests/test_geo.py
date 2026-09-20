from app.geo import bounding_box, format_km, haversine_km, pick_nearby


def test_haversine_one_degree_latitude_is_about_111km():
    km = haversine_km(20.0, 99.0, 21.0, 99.0)
    assert 110 < km < 112


def test_pick_nearby_keeps_only_places_within_20km():
    origin_lat, origin_lng = 20.0, 99.0
    rows = [
        {"att_id": "origin", "lat": 20.0, "lng": 99.0},
        {"att_id": "near", "lat": 20.05, "lng": 99.0, "name_th": "ใกล้"},
        {"att_id": "far", "lat": 20.30, "lng": 99.0, "name_th": "ไกล"},
    ]
    nearby = pick_nearby(origin_lat, origin_lng, rows, km=20, exclude_att_id="origin", limit=5)
    assert [row["att_id"] for row in nearby] == ["near"]
    assert nearby[0]["distance_km"] < 6


def test_pick_nearby_can_expand_radius_past_20km():
    origin_lat, origin_lng = 20.0, 99.0
    rows = [
        {"att_id": "near", "lat": 20.05, "lng": 99.0},
        {"att_id": "mid", "lat": 20.30, "lng": 99.0},
    ]
    tight = pick_nearby(origin_lat, origin_lng, rows, km=20, limit=5)
    wide = pick_nearby(origin_lat, origin_lng, rows, km=40, limit=5)
    assert [row["att_id"] for row in tight] == ["near"]
    assert [row["att_id"] for row in wide] == ["near", "mid"]


def test_pick_nearby_sorts_closest_first():
    rows = [
        {"att_id": "b", "lat": 20.08, "lng": 99.0},
        {"att_id": "a", "lat": 20.02, "lng": 99.0},
    ]
    nearby = pick_nearby(20.0, 99.0, rows, km=20, limit=5)
    assert [row["att_id"] for row in nearby] == ["a", "b"]


def test_bounding_box_covers_20km():
    south, north, west, east = bounding_box(20.0, 99.0, 20)
    assert south < 20.0 < north
    assert west < 99.0 < east
    assert haversine_km(20.0, 99.0, north, 99.0) >= 20


def test_format_km_uses_one_decimal_under_ten():
    assert format_km(8.04) == "8"
    assert format_km(1.26) == "1.3"
    assert format_km(18.4) == "18"
