from app.regions import normalize_region


def test_normalize_north_typo():
    assert normalize_region("ืNorth ") == "ภาคเหนือ"
    assert normalize_region("North") == "ภาคเหนือ"
    assert normalize_region(None) == "ภาคเหนือ"
    assert normalize_region("ภาคเหนือ") == "ภาคเหนือ"
