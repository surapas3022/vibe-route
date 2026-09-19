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


def test_fallback_intro_uses_latest_query_on_followup():
    from app.routers.search import _fallback_intro

    text = _fallback_intro("จะไปแม่ฮ่องสอน", True, False, followup=True)
    assert "จะไปแม่ฮ่องสอน" in text
    assert "ค้นต่อ" in text
    assert "อยากไปที่หนาวๆ" not in text
