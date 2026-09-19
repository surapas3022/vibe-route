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
