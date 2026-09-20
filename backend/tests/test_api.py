from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok_without_supabase():
    response = client.get("/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["poc_region"] == "ภาคเหนือ"
    assert body["assistant"]["level"] in {"ready", "fallback", "off"}


def test_search_requires_auth():
    response = client.post("/v1/search", json={"query": "สโลว์ไลฟ์"})
    assert response.status_code == 401


def test_delete_chat_requires_auth():
    response = client.delete("/v1/chats/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 401


def test_delete_all_chats_requires_auth():
    response = client.delete("/v1/chats")
    assert response.status_code == 401


def test_delete_image_requires_auth():
    response = client.delete("/v1/images/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 401


def test_explain_requires_auth():
    response = client.post("/v1/messages/00000000-0000-0000-0000-000000000001/explain")
    assert response.status_code == 401


def test_nearby_places_requires_auth():
    response = client.get("/v1/places/A1/nearby")
    assert response.status_code == 401


def test_register_rejects_password_mismatch():
    response = client.post(
        "/v1/auth/register",
        json={
            "email": "demo@example.com",
            "password": "password1",
            "confirm_password": "password2",
        },
    )
    assert response.status_code == 400


def test_register_rejects_invalid_email():
    response = client.post(
        "/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "password1",
            "confirm_password": "password1",
        },
    )
    assert response.status_code == 400
