from typing import Literal

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel

from app import db


class AuthUser(BaseModel):
    id: str
    email: str
    role: Literal["general", "admin"] = "general"
    email_confirmed: bool = False


def _role_from_profile(user_id: str) -> str:
    if not db.supabase_configured():
        return "general"
    try:
        result = (
            db.get_supabase()
            .table("profiles")
            .select("role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        return "general"
    rows = result.data or []
    if not rows:
        return "general"
    role = rows[0].get("role") or "general"
    return role if role in {"general", "admin"} else "general"


def require_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="ต้องเข้าสู่ระบบ")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="ต้องเข้าสู่ระบบ")
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    try:
        result = db.new_auth_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่") from exc
    user = getattr(result, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
    confirmed = bool(getattr(user, "email_confirmed_at", None))
    role_raw = _role_from_profile(str(user.id))
    role: Literal["general", "admin"] = "admin" if role_raw == "admin" else "general"
    return AuthUser(
        id=str(user.id),
        email=str(getattr(user, "email", None) or ""),
        role=role,
        email_confirmed=confirmed,
    )


def require_session(user: AuthUser = Depends(require_user)) -> str:
    """Chat/feedback/images still key off this string; now it is the auth user id."""
    return user.id
