from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx

from app.config import get_settings
from app.schemas import AssistantStatus

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
EXPLAIN_BUDGET_S = 22.0
EXPLAIN_CALL_S = 10.0

MODEL_CHAIN = [
    ("gemini", "gemini-3.5-flash-lite"),
    ("nvidia", "nvidia/llama-3.1-nemotron-nano-8b-v1"),
]

ASSISTANT_COPY = {
    "ready": AssistantStatus(
        level="ready",
        label="ผู้ช่วยพร้อม",
        detail="ค้นหาที่เที่ยวจากข้อมูล ททท. ได้ตามปกติ",
    ),
    "fallback": AssistantStatus(
        level="fallback",
        label="กำลังใช้ผู้ช่วยสำรอง",
        detail="ผู้ช่วยหลักไม่ว่างในตอนนี้ ระบบใช้ผู้ช่วยสำรองให้อัตโนมัติ ข้อมูลที่เที่ยวยังมาจากฐาน ททท. เหมือนเดิม",
    ),
    "off": AssistantStatus(
        level="off",
        label="ผู้ช่วยยังไม่พร้อม",
        detail="ผู้ช่วยอธิบายมู้ดไม่ได้ชั่วคราว แต่รายการที่เที่ยว ค่าเข้าชม และเวลาเปิดปิดด้านล่างยังเป็นข้อมูลจริงจากฐาน ไม่ได้เดา",
    ),
    "no_key": AssistantStatus(
        level="off",
        label="ผู้ช่วยยังไม่พร้อม",
        detail="ผู้ช่วยยังไม่ได้เปิดใช้ ค้นหาจากฐานข้อมูลได้ตามปกติ",
    ),
}


def health_assistant() -> AssistantStatus:
    settings = get_settings()
    if settings.nvidia_key_list:
        return ASSISTANT_COPY["ready"]
    if settings.gemini_key_list:
        return ASSISTANT_COPY["fallback"]
    return ASSISTANT_COPY["no_key"]


def _system_prompt() -> str:
    return (
        "You explain Northern Thailand places from TAT snippets as if guiding a visitor. "
        "Reply in Thai JSON only: {\"intro\": string, \"places\": [{\"att_id\": string, \"why\": string}]}. "
        "Intro must answer the LATEST request only. Do not quote or concatenate earlier queries. "
        "If the latest request names a place, lead with that place and describe being there from the snippet. "
        "Use only the provided snippets. Never invent fees, hours, phone numbers, or coordinates. "
        "Never write numbers for tickets or opening hours."
    )


def _user_prompt(
    query: str,
    cards: list[dict[str, Any]],
    prior: list[str] | None = None,
) -> str:
    slim = [
        {
            "att_id": card["att_id"],
            "name_th": card["name_th"],
            "province": card["province"],
            "type_label": card.get("type_label"),
            "snippet": (card.get("detail_clean") or "")[:280],
        }
        for card in cards
    ]
    earlier = [item.strip() for item in (prior or []) if item and item.strip()]
    history = ""
    if earlier:
        history = "Earlier requests:\n" + "\n".join(f"- {item}" for item in earlier[-4:]) + "\n"
    return (
        f"{history}"
        f"Latest request: {query}\n"
        f"Places (first card is the one to lead with):\n{json.dumps(slim, ensure_ascii=False)}"
    )


def _parse_payload(raw: str, cards: list[dict[str, Any]]) -> dict[str, Any] | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start < 0 or end < 0:
            return None
        try:
            data = json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return None
    if not isinstance(data, dict):
        return None
    by_id = {
        item.get("att_id"): item.get("why")
        for item in data.get("places") or []
        if isinstance(item, dict)
    }
    return {
        "intro": str(data.get("intro") or "").strip(),
        "whys": {key: str(value).strip() for key, value in by_id.items() if key and value},
    }


async def _nvidia(
    model: str,
    query: str,
    cards: list[dict[str, Any]],
    *,
    timeout: float = EXPLAIN_CALL_S,
    prior: list[str] | None = None,
) -> dict[str, Any] | None:
    settings = get_settings()
    keys = settings.nvidia_key_list
    if not keys:
        return None
    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": _user_prompt(query, cards, prior)},
        ],
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        for key in keys:
            try:
                response = await client.post(
                    NVIDIA_URL,
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except httpx.HTTPError:
                continue
            if response.status_code != 200:
                continue
            try:
                content = response.json()["choices"][0]["message"].get("content") or ""
            except (KeyError, IndexError, TypeError):
                continue
            parsed = _parse_payload(content, cards)
            if parsed:
                return parsed
    return None


async def _gemini(
    model: str,
    query: str,
    cards: list[dict[str, Any]],
    *,
    timeout: float = EXPLAIN_CALL_S,
    prior: list[str] | None = None,
) -> dict[str, Any] | None:
    settings = get_settings()
    keys = settings.gemini_key_list
    if not keys:
        return None
    payload = {
        "systemInstruction": {"parts": [{"text": _system_prompt()}]},
        "contents": [{"role": "user", "parts": [{"text": _user_prompt(query, cards, prior)}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 400,
            "responseMimeType": "application/json",
        },
    }
    url = GEMINI_URL.format(model=model)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for key in keys:
            try:
                response = await client.post(
                    url,
                    params={"key": key},
                    json=payload,
                )
            except httpx.HTTPError:
                continue
            if response.status_code != 200:
                continue
            try:
                content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError):
                continue
            parsed = _parse_payload(content, cards)
            if parsed:
                return parsed
    return None


async def explain_vibe(
    query: str,
    cards: list[dict[str, Any]],
    *,
    prior: list[str] | None = None,
    budget_s: float = EXPLAIN_BUDGET_S,
) -> tuple[str, dict[str, str], AssistantStatus]:
    if not cards:
        return (
            "ไม่พบที่เที่ยวในภาคเหนือที่ตรงมู้ดนี้จากฐาน ททท.",
            {},
            health_assistant(),
        )
    settings = get_settings()
    if not settings.nvidia_key_list and not settings.gemini_key_list:
        return "", {}, ASSISTANT_COPY["no_key"]

    used_fallback = False
    deadline = time.monotonic() + max(budget_s, 0.2)
    for index, (kind, model) in enumerate(MODEL_CHAIN):
        remaining = deadline - time.monotonic()
        if remaining <= 0.2:
            break
        timeout = min(EXPLAIN_CALL_S, remaining)
        try:
            parsed = await asyncio.wait_for(
                (
                    _nvidia(model, query, cards, timeout=timeout, prior=prior)
                    if kind == "nvidia"
                    else _gemini(model, query, cards, timeout=timeout, prior=prior)
                ),
                timeout=timeout,
            )
        except (asyncio.TimeoutError, httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
            parsed = None
        if parsed:
            intro = parsed["intro"] or f"จากฐาน ททท. ตามคำถาม «{query}»"
            status = ASSISTANT_COPY["fallback"] if used_fallback or index > 0 else ASSISTANT_COPY["ready"]
            return intro, parsed["whys"], status
        used_fallback = True
    return "", {}, ASSISTANT_COPY["off"]
