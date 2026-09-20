from app.routers.chats import pack_chat_summaries


def test_pack_chat_summaries_uses_latest_message():
    chats = [
        {"id": "c1", "title": "คาเฟ่วิวหมอก", "created_at": "2026-09-19T08:00:00Z"},
        {"id": "c2", "title": "วัดโบราณ", "created_at": "2026-09-19T07:00:00Z"},
    ]
    messages = [
        {"chat_id": "c1", "created_at": "2026-09-19T08:00:00Z", "places": [1, 2]},
        {"chat_id": "c1", "created_at": "2026-09-19T09:00:00Z", "places": [1, 2, 3, 4, 5, 6]},
        {"chat_id": "c2", "created_at": "2026-09-19T07:10:00Z", "places": [1, 2, 3]},
    ]
    packed = pack_chat_summaries(chats, messages)
    assert packed[0]["card_count"] == 6
    assert packed[0]["created_at"] == "2026-09-19T09:00:00Z"
    assert packed[1]["card_count"] == 3


def test_pack_chat_summaries_empty_messages():
    chats = [{"id": "c1", "title": "แชท", "created_at": "2026-09-19T08:00:00Z"}]
    packed = pack_chat_summaries(chats, [])
    assert packed[0]["card_count"] == 0
    assert packed[0]["created_at"] == "2026-09-19T08:00:00Z"


def test_pack_chat_summaries_masks_title_pii():
    chats = [
        {
            "id": "c1",
            "title": "ไปเชียงใหม่ โทร 0812345678",
            "created_at": "2026-09-19T08:00:00Z",
        }
    ]
    packed = pack_chat_summaries(chats, [])
    assert "0812345678" not in packed[0]["title"]
    assert "เชียงใหม่" in packed[0]["title"]
    assert "***" in packed[0]["title"]
