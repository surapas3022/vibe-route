import asyncio
import time
from unittest.mock import Mock

from app import llm


def test_user_prompt_keeps_latest_and_earlier_turns():
    text = llm._user_prompt(
        "จะไปแม่ฮ่องสอน",
        [{"att_id": "1", "name_th": "ห้วยจอกหลวง", "province": "แม่ฮ่องสอน"}],
        ["อยากไปที่หนาวๆ"],
    )
    assert "Latest request: จะไปแม่ฮ่องสอน" in text
    assert "อยากไปที่หนาวๆ" in text
    assert "ห้วยจอกหลวง" in text


def test_user_prompt_masks_phone_and_email():
    text = llm._user_prompt(
        "อยากไปเชียงใหม่ โทร 081-234-5678 อีเมล somchai@example.com",
        [{"att_id": "1", "name_th": "ดอยอ่างขาง", "province": "เชียงใหม่"}],
        ["ผมชื่อวิชัย อยากไปที่หนาวๆ"],
    )
    assert "081-234-5678" not in text
    assert "somchai@example.com" not in text
    assert "วิชัย" not in text
    assert "เชียงใหม่" in text
    assert "***" in text


def test_user_prompt_marks_facts_on_card_without_amounts():
    text = llm._user_prompt(
        "ฟาร์มแกะแดนพนา ค่าเข้าชมเท่าไหร่",
        [
            {
                "att_id": "1",
                "name_th": "ฟาร์มแกะแดนพนา",
                "province": "น่าน",
                "detail_clean": "สถานที่ท่องเที่ยวเชิงเกษตร",
                "fee_on_card": True,
                "hours_on_card": True,
            }
        ],
    )
    assert '"fee_on_card": true' in text
    assert '"hours_on_card": true' in text
    assert "180" not in text


BAD_FEE_INTRO = (
    "สวัสดีค่ะ ยินดีต้อนรับสู่ฟาร์มแกะแดนพนา จังหวัดน่าน "
    "สถานที่ท่องเที่ยวเชิงเกษตรในอำเภอปัว โซนที่มีภูเขา ทุ่งนา "
    "และธรรมชาติที่อุดมสมบูรณ์ เหมาะสำหรับเป็นจุดพักผ่อนของทุกคนในครอบครัว "
    "สำหรับข้อมูลเรื่องค่าเข้าชม จากข้อมูลที่มีอยู่ไม่ได้ระบุรายละเอียดเกี่ยวกับค่าใช้จ่ายไว้ค่ะ"
)


def test_redirect_fee_missing_claim_points_to_card():
    text = llm.redirect_facts_to_card(
        BAD_FEE_INTRO,
        [{"fee_on_card": True, "hours_on_card": False}],
    )
    assert "ไม่ได้ระบุ" not in text
    assert "ค่าใช้จ่ายไว้ค่ะ" not in text
    assert "การ์ดด้านล่าง" in text
    assert "ฟาร์มแกะแดนพนา" in text
    assert "เหมาะสำหรับเป็นจุดพักผ่อน" in text


def test_redirect_keeps_missing_claim_when_card_has_no_fee():
    text = llm.redirect_facts_to_card(
        BAD_FEE_INTRO,
        [{"fee_on_card": False, "hours_on_card": False}],
    )
    assert text == BAD_FEE_INTRO


def test_redirect_hours_missing_claim_points_to_card():
    intro = (
        "ดอยอ่างขางอากาศเย็นสบาย "
        "จากข้อมูลที่มีอยู่ไม่ได้ระบุเวลาเปิด-ปิดไว้ค่ะ"
    )
    text = llm.redirect_facts_to_card(
        intro,
        [{"fee_on_card": False, "hours_on_card": True}],
    )
    assert "ไม่ได้ระบุ" not in text
    assert "การ์ดด้านล่าง" in text
    assert "ดอยอ่างขางอากาศเย็นสบาย" in text


def test_explain_vibe_points_to_card_when_fee_exists(monkeypatch):
    async def fake(*_args, **_kwargs):
        return {"intro": BAD_FEE_INTRO, "whys": {"1": "ฟาร์มแกะท่ามกลางภูเขา"}}

    monkeypatch.setattr(llm, "_nvidia", fake)
    monkeypatch.setattr(llm, "_gemini", fake)
    monkeypatch.setattr(
        llm,
        "get_settings",
        lambda: Mock(nvidia_key_list=["k"], gemini_key_list=[]),
    )
    cards = [
        {
            "att_id": "1",
            "name_th": "ฟาร์มแกะแดนพนา",
            "province": "น่าน",
            "detail_clean": "สถานที่ท่องเที่ยวเชิงเกษตร",
            "fee_on_card": True,
        }
    ]

    async def run():
        return await llm.explain_vibe("ฟาร์มแกะแดนพนา ค่าเข้าชมเท่าไหร่", cards, budget_s=2)

    intro, whys, status = asyncio.run(run())
    assert "ไม่ได้ระบุ" not in intro
    assert "ค่าใช้จ่ายไว้ค่ะ" not in intro
    assert "การ์ดด้านล่าง" in intro
    assert "ฟาร์มแกะแดนพนา" in intro
    assert whys["1"] == "ฟาร์มแกะท่ามกลางภูเขา"
    assert status.level == "ready"


def test_explain_vibe_budget_stops_before_cloudflare_timeout(monkeypatch):
    async def slow(*_args, **_kwargs):
        await asyncio.sleep(5)
        return {"intro": "slow", "whys": {}}

    monkeypatch.setattr(llm, "_nvidia", slow)
    monkeypatch.setattr(llm, "_gemini", slow)
    monkeypatch.setattr(
        llm,
        "get_settings",
        lambda: Mock(nvidia_key_list=["k"], gemini_key_list=["g"]),
    )
    cards = [
        {
            "att_id": "1",
            "name_th": "ดอยอ่างขาง",
            "province": "เชียงใหม่",
            "detail_clean": "อากาศหนาว",
        }
    ]

    async def run():
        return await llm.explain_vibe("ที่ไหนหน้าหนาว น่าไปสุด", cards, budget_s=0.4)

    started = time.monotonic()
    intro, whys, status = asyncio.run(run())
    elapsed = time.monotonic() - started
    assert elapsed < 1.5
    assert intro == ""
    assert whys == {}
    assert status.level == "off"
