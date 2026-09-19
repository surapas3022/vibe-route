from types import SimpleNamespace

from app import db
from app.db import keyword_queries, fetch_chat_queries


def test_retrieval_query_uses_prior_chat_turns(monkeypatch):
    from app.routers.search import _retrieval_query

    monkeypatch.setattr(
        db,
        "fetch_chat_queries",
        lambda *_args, **_kwargs: ["อยากไปที่เงียบๆ สโลว์ไลฟ์"],
    )
    text = _retrieval_query("เอาเชียงราย", chat_id="c1", session_id="user-1")
    assert "สโลว์ไลฟ์" in text
    assert "เชียงราย" in text


def test_fetch_chat_queries_skips_empty_chat_id():
    assert fetch_chat_queries(None, "user-1") == []
    assert fetch_chat_queries("", "user-1") == []


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _FakeResult(self._data)


def test_fetch_chat_queries_returns_turns_before_message(monkeypatch):
    class FakeClient:
        def table(self, name):
            if name == "chats":
                return _FakeQuery([{"id": "c1"}])
            return _FakeQuery(
                [
                    {"id": "m1", "query": "อยากไปที่เงียบๆ สโลว์ไลฟ์"},
                    {"id": "m2", "query": "เอาเชียงราย"},
                ]
            )

    monkeypatch.setattr(db, "supabase_configured", lambda: True)
    monkeypatch.setattr(db, "get_supabase", lambda: FakeClient())
    assert fetch_chat_queries("c1", "user-1") == [
        "อยากไปที่เงียบๆ สโลว์ไลฟ์",
        "เอาเชียงราย",
    ]
    assert fetch_chat_queries("c1", "user-1", before_message_id="m2") == [
        "อยากไปที่เงียบๆ สโลว์ไลฟ์"
    ]


def test_winter_vibe_query_extracts_season_hints():
    tokens = keyword_queries("ที่ไหนหน้าหนาว น่าไปสุด")
    assert "หน้าหนาว" in tokens
    assert "หนาว" in tokens
    assert tokens[0] == "ที่ไหนหน้าหนาว น่าไปสุด"


def test_auth_client_does_not_share_data_client(monkeypatch):
    db._client = None
    created: list[SimpleNamespace] = []

    def fake_create(url: str, key: str):
        item = SimpleNamespace(url=url, key=key)
        created.append(item)
        return item

    settings = SimpleNamespace(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="anon-key",
        supabase_anon_key="",
        supabase_key="service-key",
    )
    monkeypatch.setattr(db, "create_client", fake_create)
    monkeypatch.setattr(db, "get_settings", lambda: settings)
    data = db.get_supabase()
    auth_one = db.new_auth_client()
    auth_two = db.new_auth_client()
    assert data is db.get_supabase()
    assert data.key == "service-key"
    assert auth_one.key == "anon-key"
    assert auth_one is not data
    assert auth_two is not data
    assert auth_one is not auth_two
    assert len(created) == 3
    db._client = None
