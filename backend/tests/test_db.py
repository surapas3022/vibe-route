from types import SimpleNamespace

from app import db
from app.db import keyword_queries, fetch_chat_queries, fetch_session_votes
from app.privacy import mask_query


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

    def in_(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
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


def test_fetch_chat_queries_masks_stored_pii(monkeypatch):
    class FakeClient:
        def table(self, name):
            if name == "chats":
                return _FakeQuery([{"id": "c1"}])
            return _FakeQuery(
                [
                    {"id": "m1", "query": "อยากไปเชียงใหม่ โทร 0812345678"},
                ]
            )

    monkeypatch.setattr(db, "supabase_configured", lambda: True)
    monkeypatch.setattr(db, "get_supabase", lambda: FakeClient())
    rows = fetch_chat_queries("c1", "user-1")
    assert rows == [mask_query("อยากไปเชียงใหม่ โทร 0812345678")]
    assert "0812345678" not in rows[0]
    assert "เชียงใหม่" in rows[0]


def test_fetch_session_votes_keeps_latest_rating(monkeypatch):
    class FakeClient:
        def table(self, name):
            if name == "feedback":
                return _FakeQuery(
                    [
                        {
                            "att_id": "cave",
                            "rating": 1,
                            "message_id": "m1",
                            "created_at": "2026-09-20T08:00:00Z",
                        },
                        {
                            "att_id": "cave",
                            "rating": -1,
                            "message_id": "m2",
                            "created_at": "2026-09-20T09:00:00Z",
                        },
                        {
                            "att_id": "park",
                            "rating": 1,
                            "message_id": "m1",
                            "created_at": "2026-09-20T08:00:00Z",
                        },
                    ]
                )
            if name == "messages":
                return _FakeQuery(
                    [
                        {"id": "m1", "query": "อยากเดินป่า", "retrieval_query": "อยากเดินป่า"},
                        {"id": "m2", "query": "ถ้ำน้ำบ่อผี", "retrieval_query": "ถ้ำน้ำบ่อผี"},
                    ]
                )
            return _FakeQuery(
                [
                    {"att_id": "cave", "type_label": "ถ้ำ"},
                    {"att_id": "park", "type_label": "อุทยานแห่งชาติ"},
                ]
            )

    monkeypatch.setattr(db, "supabase_configured", lambda: True)
    monkeypatch.setattr(db, "get_supabase", lambda: FakeClient())
    votes = {item["att_id"]: item for item in fetch_session_votes("user-1")}
    assert votes["cave"]["rating"] == -1
    assert votes["cave"]["vibe"] == "ถ้ำน้ำบ่อผี"
    assert votes["park"]["rating"] == 1
    assert votes["park"]["type_label"] == "อุทยานแห่งชาติ"
    assert votes["park"]["vibe"] == "อยากเดินป่า"


def test_fetch_session_votes_skips_empty_session():
    assert fetch_session_votes("") == []


def test_fetch_session_votes_keeps_main_and_secondary_lanes(monkeypatch):
    class FakeClient:
        def table(self, name):
            if name == "feedback":
                return _FakeQuery(
                    [
                        {
                            "att_id": "doi",
                            "rating": 1,
                            "message_id": "m-secondary",
                            "created_at": "2026-09-20T08:00:00Z",
                        },
                        {
                            "att_id": "doi",
                            "rating": 1,
                            "message_id": "m-main",
                            "created_at": "2026-09-20T09:00:00Z",
                        },
                    ]
                )
            if name == "messages":
                return _FakeQuery(
                    [
                        {
                            "id": "m-secondary",
                            "query": "อยากเดินป่า",
                            "retrieval_query": "อยากเดินป่า",
                            "prefer_secondary": True,
                            "province": None,
                            "places": [{"province": "น่าน"}, {"province": "เชียงใหม่"}],
                        },
                        {
                            "id": "m-main",
                            "query": "อยากเดินป่า",
                            "retrieval_query": "อยากเดินป่า",
                            "prefer_secondary": True,
                            "province": "เชียงใหม่",
                            "places": [{"province": "เชียงใหม่"}],
                        },
                    ]
                )
            return _FakeQuery([{"att_id": "doi", "type_label": "จุดชมวิว"}])

    monkeypatch.setattr(db, "supabase_configured", lambda: True)
    monkeypatch.setattr(db, "get_supabase", lambda: FakeClient())
    votes = {(item["att_id"], item["secondary_focus"]): item for item in fetch_session_votes("user-1")}
    assert votes[("doi", True)]["rating"] == 1
    assert votes[("doi", False)]["rating"] == 1
    assert votes[("doi", False)]["type_label"] == "จุดชมวิว"


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
