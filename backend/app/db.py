from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from app.config import Settings, get_settings

_client: Client | None = None


def get_supabase() -> Client:
    """Service-role client for table/RPC access. Never sign a user in on this client."""
    global _client
    settings = get_settings()
    if _client is None:
        if not settings.supabase_url or not settings.supabase_key:
            raise RuntimeError("Supabase is not configured")
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


def new_auth_client() -> Client:
    """Fresh Auth API client so user sessions cannot leak into listing queries."""
    settings = get_settings()
    if not settings.supabase_url:
        raise RuntimeError("Supabase is not configured")
    key = (
        settings.supabase_publishable_key
        or settings.supabase_anon_key
        or settings.supabase_key
    )
    if not key:
        raise RuntimeError("Supabase is not configured")
    return create_client(settings.supabase_url, key)


def supabase_configured(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return bool(settings.supabase_url and settings.supabase_key)


def _count(query) -> int:
    result = query.limit(1).execute()
    return int(result.count or 0)


def listing_count(region: str | None = None) -> int:
    if not supabase_configured():
        return 0
    query = get_supabase().table("listings").select("att_id", count="exact")
    if region:
        query = query.eq("region", region)
    return _count(query)


def embedded_count(region: str | None = None, *, column: str = "embedding_nvidia") -> int:
    if not supabase_configured():
        return 0
    query = (
        get_supabase()
        .table("listings")
        .select("att_id", count="exact")
        .not_.is_(column, "null")
    )
    if region:
        query = query.eq("region", region)
    return _count(query)


def fetch_listings_by_ids(att_ids: list[str]) -> list[dict[str, Any]]:
    if not att_ids:
        return []
    result = get_supabase().table("listings").select("*").in_("att_id", att_ids).execute()
    by_id = {row["att_id"]: row for row in result.data or []}
    return [by_id[att_id] for att_id in att_ids if att_id in by_id]


def fetch_chat_queries(
    chat_id: str | None,
    session_id: str,
    *,
    before_message_id: str | None = None,
) -> list[str]:
    if not chat_id or not session_id or not supabase_configured():
        return []
    client = get_supabase()
    owned = (
        client.table("chats")
        .select("id")
        .eq("id", chat_id)
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    if not owned.data:
        return []
    result = (
        client.table("messages")
        .select("id,query,created_at")
        .eq("chat_id", chat_id)
        .order("created_at")
        .execute()
    )
    queries: list[str] = []
    for row in result.data or []:
        if before_message_id and str(row.get("id")) == str(before_message_id):
            break
        text = str(row.get("query") or "").strip()
        if text:
            queries.append(text)
    return queries


def match_listings(
    embedding: list[float],
    *,
    region: str,
    province: str | None,
    match_count: int,
    backend: str,
) -> list[dict[str, Any]]:
    rpc = "match_listings_nvidia" if backend == "nvidia" else "match_listings_gemini"
    payload: dict[str, Any] = {
        "query_embedding": embedding,
        "match_count": match_count,
        "filter_region": region,
        "filter_province": province,
    }
    result = get_supabase().rpc(rpc, payload).execute()
    return result.data or []


VIBE_HINTS = (
    "หน้าหนาว",
    "หนาว",
    "หมอก",
    "ดอย",
    "น้ำตก",
    "ชุมชน",
    "สโลว์",
    "ทะเลหมอก",
    "ดอกไม้",
    "กาแฟ",
    "วัด",
    "อุทยาน",
)


def keyword_queries(query: str) -> list[str]:
    text = " ".join((query or "").split())
    found: list[str] = []
    seen: set[str] = set()

    def add(item: str) -> None:
        item = item.strip()
        if len(item) < 2 or item in seen:
            return
        seen.add(item)
        found.append(item)

    add(text)
    for part in text.split():
        add(part)
    for hint in VIBE_HINTS:
        if hint in text:
            add(hint)
    return found


def _keyword_fetch(
    needle: str,
    *,
    region: str,
    province: str | None,
    match_count: int,
) -> list[dict[str, Any]]:
    q = get_supabase().table("listings").select("*").eq("region", region)
    if province:
        q = q.eq("province", province)
    result = q.ilike("search_text", f"%{needle}%").limit(match_count).execute()
    rows = []
    for index, row in enumerate(result.data or []):
        rows.append({**row, "score_vector": max(0.2, 0.6 - index * 0.03)})
    return rows


def keyword_listings(
    query: str,
    *,
    region: str,
    province: str | None,
    match_count: int,
) -> list[dict[str, Any]]:
    for needle in keyword_queries(query):
        rows = _keyword_fetch(
            needle,
            region=region,
            province=province,
            match_count=match_count,
        )
        if rows:
            return rows
    return []


def upsert_listings(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    get_supabase().table("listings").upsert(rows, on_conflict="att_id").execute()


def existing_embedded_ids(region: str, *, column: str) -> set[str]:
    ids: set[str] = set()
    start = 0
    page = 1000
    client = get_supabase()
    while True:
        result = (
            client.table("listings")
            .select("att_id")
            .eq("region", region)
            .not_.is_(column, "null")
            .range(start, start + page - 1)
            .execute()
        )
        rows = result.data or []
        ids.update(row["att_id"] for row in rows)
        if len(rows) < page:
            break
        start += page
    return ids


def region_counts() -> list[dict[str, Any]]:
    result = get_supabase().rpc("listing_region_counts").execute()
    return result.data or []


def province_counts(region: str | None = None) -> list[dict[str, Any]]:
    result = get_supabase().rpc("listing_province_counts", {"filter_region": region}).execute()
    return result.data or []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hide_chat(chat_id: str, session_id: str) -> bool:
    client = get_supabase()
    existing = (
        client.table("chats")
        .select("id")
        .eq("id", chat_id)
        .eq("session_id", session_id)
        .is_("hidden_at", "null")
        .execute()
    )
    if not existing.data:
        return False
    client.table("chats").update({"hidden_at": _now_iso()}).eq("id", chat_id).eq("session_id", session_id).execute()
    return True


def hide_all_chats(session_id: str) -> int:
    result = (
        get_supabase()
        .table("chats")
        .update({"hidden_at": _now_iso()})
        .eq("session_id", session_id)
        .is_("hidden_at", "null")
        .execute()
    )
    return len(result.data or [])
