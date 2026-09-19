from app.rewrite import retrieval_query


def test_first_turn_stays_as_typed():
    assert retrieval_query("อยากไปที่เงียบๆ สโลว์ไลฟ์", []) == "อยากไปที่เงียบๆ สโลว์ไลฟ์"


def test_followup_keeps_base_vibe():
    text = retrieval_query("เอาเชียงราย", ["อยากไปที่เงียบๆ สโลว์ไลฟ์"])
    assert "สโลว์ไลฟ์" in text
    assert "เชียงราย" in text


def test_keeps_first_vibe_and_latest_followups():
    prior = ["มู้ดต้น", "รอบสอง", "รอบสาม", "รอบสี่", "รอบห้า"]
    text = retrieval_query("ปัจจุบัน", prior)
    assert text.startswith("มู้ดต้น")
    assert "รอบสอง" not in text
    assert "รอบสาม" in text
    assert "รอบสี่" in text
    assert "รอบห้า" in text
    assert text.endswith("ปัจจุบัน")


def test_duplicate_followup_is_not_repeated():
    text = retrieval_query("เอาเชียงราย", ["สโลว์ไลฟ์", "เอาเชียงราย"])
    assert text == "สโลว์ไลฟ์ เอาเชียงราย"


def test_named_place_followup_does_not_bury_the_place():
    from app.rewrite import is_specific_place_query, name_hit, retrieval_query as rewrite_query

    assert is_specific_place_query("ถ้ำน้ำบ่อผี มีอะไรบ้าง")
    assert not is_specific_place_query("อยากไปที่หนาวๆ มีที่ไหนน่าไปบ้าง")
    text = rewrite_query(
        "ถ้ำน้ำบ่อผี มีอะไรบ้าง",
        ["อยากไปที่หนาวๆ มีที่ไหนน่าไปบ้าง", "จะไปแม่ฮ่องสอน ห้วยจอกหลวง"],
    )
    assert text == "ถ้ำน้ำบ่อผี มีอะไรบ้าง"
    assert "หนาว" not in text
    assert name_hit("ถ้ำน้ำบ่อผี มีอะไรบ้าง", "ถ้ำน้ำบ่อผี") == 2
    assert name_hit("จะไปแม่ฮ่องสอน ห้วยจอกหลวง", "ห้วยจอกหลวง") == 2


def test_fallback_intro_uses_latest_query_on_followup():
    from app.routers.search import _fallback_intro

    text = _fallback_intro("จะไปแม่ฮ่องสอน", True, False, followup=True)
    assert "จะไปแม่ฮ่องสอน" in text
    assert "ค้นต่อ" in text
    assert "อยากไปที่หนาวๆ" not in text
