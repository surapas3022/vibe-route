from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.embed import (
    EmbedError,
    _active_key,
    _daily_quota,
    _dead,
    _input_type,
    _retry_wait,
    embed_nvidia_texts,
    reset_key_state,
)


def test_input_type_maps_task_names():
    assert _input_type("RETRIEVAL_QUERY") == "query"
    assert _input_type("RETRIEVAL_DOCUMENT") == "passage"


def test_daily_quota_detects_free_tier_rpd():
    body = "Quota exceeded for metric EmbedContentRequestsPerDayPerProjectPerModel-FreeTier"
    assert _daily_quota(body) is True
    assert _daily_quota("RESOURCE_EXHAUSTED per-minute") is False


def test_retry_wait_caps_between_five_and_ninety():
    assert 5 <= _retry_wait(SimpleNamespace(headers={}), 0) <= 90
    assert _retry_wait(SimpleNamespace(headers={"retry-after": "12"}), 0) == 12


def test_active_key_skips_dead(monkeypatch):
    reset_key_state()
    settings = Mock()
    settings.nvidia_key_list = ["k1", "k2"]
    settings.gemini_key_list = []
    monkeypatch.setattr("app.embed.get_settings", lambda: settings)
    assert _active_key("nvidia") == "k1"
    _dead["nvidia"].add("k1")
    assert _active_key("nvidia") == "k2"
    reset_key_state()


def test_quick_embed_raises_instead_of_waiting_on_rate_limit(monkeypatch):
    reset_key_state()
    settings = Mock()
    settings.nvidia_key_list = ["k1"]
    settings.nvidia_embed_model = "nvidia/nemotron-3-embed-1b"
    settings.embed_dims_nvidia = 2048
    monkeypatch.setattr("app.embed.get_settings", lambda: settings)

    class FakeResponse:
        status_code = 429
        text = "rate limited"
        headers = {}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr("app.embed.httpx.AsyncClient", FakeClient)

    import asyncio
    import time

    started = time.monotonic()
    with pytest.raises(EmbedError):
        asyncio.run(embed_nvidia_texts(["hi"], task_type="RETRIEVAL_QUERY", quick=True))
    assert time.monotonic() - started < 2
    reset_key_state()


def test_query_embed_payload_masks_phone(monkeypatch):
    reset_key_state()
    settings = Mock()
    settings.nvidia_key_list = ["k1"]
    settings.nvidia_embed_model = "nvidia/nemotron-3-embed-1b"
    settings.embed_dims_nvidia = 2
    monkeypatch.setattr("app.embed.get_settings", lambda: settings)
    captured: dict = {}

    class FakeResponse:
        status_code = 200
        text = ""

        def json(self):
            return {"data": [{"index": 0, "embedding": [0.1, 0.2]}]}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **kwargs):
            captured["payload"] = kwargs.get("json")
            return FakeResponse()

    monkeypatch.setattr("app.embed.httpx.AsyncClient", FakeClient)
    import asyncio

    asyncio.run(embed_nvidia_texts(["ไปเชียงใหม่ โทร 0812345678"], task_type="RETRIEVAL_QUERY"))
    sent = captured["payload"]["input"][0]
    assert "0812345678" not in sent
    assert "เชียงใหม่" in sent
    reset_key_state()


def test_document_embed_keeps_listing_phone(monkeypatch):
    reset_key_state()
    settings = Mock()
    settings.nvidia_key_list = ["k1"]
    settings.nvidia_embed_model = "nvidia/nemotron-3-embed-1b"
    settings.embed_dims_nvidia = 2
    monkeypatch.setattr("app.embed.get_settings", lambda: settings)
    captured: dict = {}

    class FakeResponse:
        status_code = 200
        text = ""

        def json(self):
            return {"data": [{"index": 0, "embedding": [0.1, 0.2]}]}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **kwargs):
            captured["payload"] = kwargs.get("json")
            return FakeResponse()

    monkeypatch.setattr("app.embed.httpx.AsyncClient", FakeClient)
    import asyncio

    asyncio.run(embed_nvidia_texts(["โทร 053-277-222 ตามฐาน TAT"], task_type="RETRIEVAL_DOCUMENT"))
    sent = captured["payload"]["input"][0]
    assert "053-277-222" in sent
    reset_key_state()
