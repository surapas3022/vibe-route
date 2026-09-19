import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import db
from app.config import get_settings
from app.deps import AuthUser, require_user

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: AuthUser


def _clean_email(raw: str) -> str:
    email = raw.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="อีเมลไม่ถูกต้อง")
    return email


def _admin_emails() -> set[str]:
    return {part.strip().lower() for part in get_settings().admin_emails.split(",") if part.strip()}


def _ensure_profile(user_id: str, email: str) -> Literal["general", "admin"]:
    role: Literal["general", "admin"] = "admin" if email.lower() in _admin_emails() else "general"
    client = db.get_supabase()
    try:
        existing = client.table("profiles").select("id,role").eq("id", user_id).limit(1).execute()
        if existing.data:
            current = existing.data[0].get("role") or "general"
            if role == "admin" and current != "admin":
                client.table("profiles").update({"role": "admin", "email": email}).eq("id", user_id).execute()
                return "admin"
            return current if current in {"general", "admin"} else "general"
        client.table("profiles").insert({"id": user_id, "email": email, "role": role}).execute()
    except Exception:
        return role
    return role


def _pack_session(session: Any, *, role: Literal["general", "admin"] | None = None) -> AuthResponse:
    user = session.user
    email = str(getattr(user, "email", None) or "")
    user_id = str(user.id)
    resolved = role or _ensure_profile(user_id, email)
    confirmed = bool(getattr(user, "email_confirmed_at", None))
    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token or "",
        user=AuthUser(
            id=user_id,
            email=email,
            role=resolved,
            email_confirmed=confirmed,
        ),
    )


def _auth_error(exc: Exception) -> HTTPException:
    text = str(exc).lower()
    if "already registered" in text or "already been registered" in text or "user already" in text:
        return HTTPException(status_code=409, detail="อีเมลนี้สมัครแล้ว")
    if "invalid login" in text or "invalid_credentials" in text:
        return HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    return HTTPException(status_code=400, detail="เข้าสู่ระบบไม่สำเร็จ")


@router.post("/v1/auth/register", response_model=AuthResponse)
def register(body: RegisterRequest):
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน")
    email = _clean_email(body.email)
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    client = db.get_supabase()
    try:
        created = client.auth.admin.create_user(
            {
                "email": email,
                "password": body.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise _auth_error(exc) from exc
    created_user = getattr(created, "user", None)
    if created_user is None:
        raise HTTPException(status_code=400, detail="สมัครไม่สำเร็จ")
    role = _ensure_profile(str(created_user.id), email)
    try:
        signed = db.new_auth_client().auth.sign_in_with_password(
            {"email": email, "password": body.password}
        )
    except Exception as exc:
        raise _auth_error(exc) from exc
    session = getattr(signed, "session", None)
    if session is None:
        raise HTTPException(status_code=400, detail="สมัครสำเร็จ แต่เข้าสู่ระบบไม่สำเร็จ")
    return _pack_session(session, role=role)


@router.post("/v1/auth/login", response_model=AuthResponse)
def login(body: LoginRequest):
    email = _clean_email(body.email)
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    try:
        signed = db.new_auth_client().auth.sign_in_with_password(
            {"email": email, "password": body.password}
        )
    except Exception as exc:
        raise _auth_error(exc) from exc
    session = getattr(signed, "session", None)
    if session is None:
        raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    return _pack_session(session)


@router.post("/v1/auth/refresh", response_model=AuthResponse)
def refresh(body: RefreshRequest):
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    try:
        signed = db.new_auth_client().auth.refresh_session(body.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่") from exc
    session = getattr(signed, "session", None)
    if session is None:
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
    return _pack_session(session)


@router.get("/v1/auth/me", response_model=AuthUser)
def me(user: AuthUser = Depends(require_user)):
    return user
