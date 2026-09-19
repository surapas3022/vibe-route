from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.deps import require_session
from app.schemas import Place

router = APIRouter()


@router.get("/v1/chats")
def list_chats(session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        return {"chats": []}
    result = (
        db.get_supabase()
        .table("chats")
        .select("id,title,created_at")
        .eq("session_id", session_id)
        .is_("hidden_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return {"chats": result.data or []}


@router.get("/v1/chats/{chat_id}")
def get_chat(chat_id: str, session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        raise HTTPException(status_code=404, detail="ไม่พบแชท")
    client = db.get_supabase()
    chat = (
        client.table("chats")
        .select("id")
        .eq("id", chat_id)
        .eq("session_id", session_id)
        .is_("hidden_at", "null")
        .execute()
    )
    if not chat.data:
        raise HTTPException(status_code=404, detail="ไม่พบแชท")
    messages = (
        client.table("messages")
        .select("id,query,intro,assistant,prefer_secondary,places,map_points,created_at")
        .eq("chat_id", chat_id)
        .order("created_at")
        .execute()
    )
    packed = []
    for row in messages.data or []:
        packed.append(
            {
                "id": row["id"],
                "query": row["query"],
                "intro": row["intro"],
                "assistant": row.get("assistant") or {},
                "prefer_secondary": row["prefer_secondary"],
                "places": [Place.model_validate(item).model_dump() for item in row.get("places") or []],
                "map_points": row.get("map_points") or [],
                "created_at": row["created_at"],
            }
        )
    return {"id": chat_id, "messages": packed}


@router.delete("/v1/chats/{chat_id}")
def delete_chat(chat_id: str, session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        raise HTTPException(status_code=404, detail="ไม่พบแชท")
    if not db.hide_chat(chat_id, session_id):
        raise HTTPException(status_code=404, detail="ไม่พบแชท")
    return {"ok": True, "id": chat_id, "hidden": True}


@router.delete("/v1/chats")
def delete_all_chats(session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        return {"ok": True, "hidden": 0}
    hidden = db.hide_all_chats(session_id)
    return {"ok": True, "hidden": hidden}
