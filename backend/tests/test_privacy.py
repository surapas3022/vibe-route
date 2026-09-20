from app.privacy import mask_query


def test_mood_query_stays_as_typed():
    text = "อยากไปที่เงียบๆ สโลว์ไลฟ์ หลีกหนีความวุ่นวาย"
    assert mask_query(text) == text


def test_place_names_are_not_treated_as_people():
    for text in (
        "นางนอน",
        "ดอยนางนอน",
        "ถ้ำน้ำบ่อผี มีอะไรบ้าง",
        "จะไปแม่ฮ่องสอน",
        "Chiang Mai ทะเลหมอก",
    ):
        assert mask_query(text) == text


def test_opening_hours_are_not_phones():
    text = "เปิด 06.00 - 18.00 น. เชียงใหม่"
    assert mask_query(text) == text
    assert "06.00" in mask_query(text)


def test_email_is_redacted():
    text = "อยากไปเชียงใหม่ อีเมล somchai@example.com ด้วย"
    out = mask_query(text)
    assert "somchai@example.com" not in out
    assert "เชียงใหม่" in out
    assert "***" in out


def test_thai_mobile_is_redacted():
    text = "ไปเชียงราย โทร 081-234-5678"
    out = mask_query(text)
    assert "081-234-5678" not in out
    assert "081" not in out
    assert "เชียงราย" in out
    assert "***" in out


def test_plus66_mobile_is_redacted():
    text = "ติดต่อ +66 81 234 5678 แล้วไปดอยอินทนนท์"
    out = mask_query(text)
    assert "81 234 5678" not in out
    assert "+66" not in out
    assert "ดอยอินทนนท์" in out


def test_compact_mobile_is_redacted():
    out = mask_query("อยากไปชุมชน โทร0812345678")
    assert "0812345678" not in out
    assert "ชุมชน" in out


def test_person_name_with_title_is_redacted():
    text = "นางสาวสมศรีอยากไปเชียงใหม่"
    out = mask_query(text)
    assert "สมศรี" not in out
    assert "เชียงใหม่" in out
    assert "***" in out


def test_self_identified_name_is_redacted():
    text = "ผมชื่อวิชัย อยากไปที่หนาวๆ"
    out = mask_query(text)
    assert "วิชัย" not in out
    assert "หนาว" in out


def test_thai_id_is_redacted():
    text = "บัตร 1-2345-67890-12-1 ไปเชียงใหม่"
    out = mask_query(text)
    assert "1-2345-67890-12-1" not in out
    assert "1234567890121" not in out.replace("-", "")
    assert "เชียงใหม่" in out


def test_mask_is_idempotent():
    text = "โทร 0812345678 อีเมล a@b.co นางสาวสมศรี"
    once = mask_query(text)
    assert mask_query(once) == once


def test_line_id_is_redacted_but_place_words_stay():
    out = mask_query("Line id: somchai88 ไปดอยอินทนนท์")
    assert "somchai88" not in out
    assert "ดอยอินทนนท์" in out


def test_polite_you_and_place_labels_are_not_names():
    assert mask_query("คุณช่วยหาที่เงียบๆ") == "คุณช่วยหาที่เงียบๆ"
    assert mask_query("ชื่อสถานที่ในเชียงใหม่") == "ชื่อสถานที่ในเชียงใหม่"
