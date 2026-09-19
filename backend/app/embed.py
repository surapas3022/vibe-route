from __future__ import annotations

import asyncio
import time
from collections import defaultdict

import httpx

from app.config import get_settings

NVIDIA_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings"
GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"
GEMINI_BATCH_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
)

NVIDIA_RPM = 30
GEMINI_RPM = 80
RPM_WINDOW = 60.0

_times: dict[str, list[float]] = defaultdict(list)
_dead: dict[str, set[str]] = {"nvidia": set(), "gemini": set()}
_skipped: dict[str, set[str]] = {"nvidia": set(), "gemini": set()}


class EmbedError(RuntimeError):
    pass


def reset_key_state() -> None:
    _times.clear()
    _dead["nvidia"].clear()
    _dead["gemini"].clear()
    _skipped["nvidia"].clear()
    _skipped["gemini"].clear()


def _mask(key: str) -> str:
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}…{key[-4:]}"


def _input_type(task_type: str) -> str:
    if task_type in {"RETRIEVAL_QUERY", "query"}:
        return "query"
    return "passage"


def _daily_quota(body: str) -> bool:
    compact = body.replace("_", "").replace("-", "").lower()
    return "perday" in compact or "requestsperday" in compact


def _retry_wait(response: httpx.Response, attempt: int) -> float:
    retry_after = response.headers.get("retry-after")
    try:
        wait = float(retry_after) if retry_after else 8 * (2 ** min(attempt, 4))
    except ValueError:
        wait = 8 * (2 ** min(attempt, 4))
    return min(max(wait, 5), 90)


def _keys(provider: str) -> list[str]:
    settings = get_settings()
    raw = settings.nvidia_key_list if provider == "nvidia" else settings.gemini_key_list
    return [key for key in raw if key not in _dead[provider]]


def _active_key(provider: str) -> str:
    live = _keys(provider)
    label = "NVIDIA" if provider == "nvidia" else "Gemini"
    if not live:
        raise EmbedError(f"{label} keys หมดโควตาหรือใช้ไม่ได้ทั้งหมด")
    for key in live:
        if key not in _skipped[provider]:
            return key
    return live[0]


async def _pace(provider: str, key: str, budget: int, *, quick: bool = False) -> None:
    times = _times[f"{provider}:{key}"]
    now = time.monotonic()
    cutoff = now - RPM_WINDOW
    while times and times[0] < cutoff:
        times.pop(0)
    if len(times) >= budget:
        wait = RPM_WINDOW - (now - times[0]) + 0.5
        wait = max(wait, 1.0)
        if quick:
            raise EmbedError(f"{provider} paced")
        print(f"{provider} {_mask(key)} paced, waiting {wait:.0f}s", flush=True)
        await asyncio.sleep(wait)
    times.append(time.monotonic())


def _handle_status(provider: str, key: str, status: int, body: str, attempt: int) -> float | None:
    """Return wait seconds, or None to retry immediately, or raise."""
    label = "NVIDIA" if provider == "nvidia" else "Gemini"
    if status in {401, 403}:
        _dead[provider].add(key)
        print(f"{label} key {_mask(key)} rejected ({status}), next key", flush=True)
        return 0
    if status == 429:
        if provider == "gemini" and _daily_quota(body):
            _dead[provider].add(key)
            print(f"{label} key {_mask(key)} daily quota full, next key", flush=True)
            return 0
        _skipped[provider].add(key)
        others = [item for item in _keys(provider) if item not in _skipped[provider]]
        if others:
            print(f"{label} key {_mask(key)} per-minute 429, next key", flush=True)
            return 0
        wait = min(max(8 * (2 ** min(attempt, 4)), 5), 90)
        print(f"all {label} keys per-minute limited, waiting {wait:.0f}s", flush=True)
        _skipped[provider].clear()
        return wait
    if status >= 400:
        raise EmbedError(f"{label} embed failed ({status}): {body[:240]}")
    _skipped[provider].discard(key)
    return None


async def embed_nvidia_texts(
    texts: list[str],
    *,
    task_type: str,
    quick: bool = False,
) -> list[list[float]]:
    if not texts:
        return []
    settings = get_settings()
    if not settings.nvidia_key_list:
        raise EmbedError("NVIDIA_API_KEY is missing")
    payload = {
        "model": settings.nvidia_embed_model,
        "input": [text[:6000] for text in texts],
        "input_type": _input_type(task_type),
        "encoding_format": "float",
        "truncate": "END",
    }
    last_error = "NVIDIA embed failed"
    timeout = 8.0 if quick else 60.0
    attempts = 2 if quick else 20
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(attempts):
            key = _active_key("nvidia")
            await _pace("nvidia", key, NVIDIA_RPM, quick=quick)
            response = await client.post(
                NVIDIA_EMBED_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )
            wait = _handle_status("nvidia", key, response.status_code, response.text, attempt)
            if wait is not None:
                last_error = "NVIDIA embed rate limited"
                if quick and wait > 0:
                    raise EmbedError(last_error)
                if wait:
                    await asyncio.sleep(wait)
                continue
            rows = sorted(response.json().get("data") or [], key=lambda item: int(item.get("index") or 0))
            values = [item.get("embedding") for item in rows]
            if len(values) != len(texts) or not all(values):
                raise EmbedError("NVIDIA embedding size mismatch")
            packed = [[float(value) for value in row] for row in values]
            if any(len(row) != settings.embed_dims_nvidia for row in packed):
                raise EmbedError("NVIDIA embedding dim mismatch")
            return packed
    raise EmbedError(last_error)


async def embed_gemini_texts(
    texts: list[str],
    *,
    task_type: str,
    quick: bool = False,
) -> list[list[float]]:
    if not texts:
        return []
    settings = get_settings()
    if not settings.gemini_key_list:
        raise EmbedError("GEMINI_API_KEY is missing")
    url = GEMINI_BATCH_URL.format(model=settings.gemini_embed_model)
    payload = {
        "requests": [
            {
                "model": f"models/{settings.gemini_embed_model}",
                "content": {"parts": [{"text": text[:8000]}]},
                "taskType": task_type,
                "outputDimensionality": settings.embed_dims_gemini,
            }
            for text in texts
        ]
    }
    last_error = "Gemini embed failed"
    timeout = 8.0 if quick else 60.0
    attempts = 2 if quick else 20
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(attempts):
            key = _active_key("gemini")
            await _pace("gemini", key, GEMINI_RPM, quick=quick)
            response = await client.post(url, params={"key": key}, json=payload)
            wait = _handle_status("gemini", key, response.status_code, response.text, attempt)
            if wait is not None:
                last_error = "Gemini embed rate limited"
                if quick and wait > 0:
                    raise EmbedError(last_error)
                if wait:
                    await asyncio.sleep(wait)
                continue
            embeddings = response.json().get("embeddings") or []
            values = [item.get("values") for item in embeddings]
            if len(values) == len(texts) and all(values):
                packed = [[float(value) for value in row] for row in values]
                if any(len(row) != settings.embed_dims_gemini for row in packed):
                    raise EmbedError("Gemini embedding dim mismatch")
                return packed
            raise EmbedError("Gemini batch embedding size mismatch")
    raise EmbedError(last_error)


async def embed_nvidia_text(text: str, *, task_type: str, quick: bool = False) -> list[float]:
    return (await embed_nvidia_texts([text], task_type=task_type, quick=quick))[0]


async def embed_gemini_text(text: str, *, task_type: str, quick: bool = False) -> list[float]:
    settings = get_settings()
    if not settings.gemini_key_list:
        raise EmbedError("GEMINI_API_KEY is missing")
    url = GEMINI_EMBED_URL.format(model=settings.gemini_embed_model)
    payload = {
        "model": f"models/{settings.gemini_embed_model}",
        "content": {"parts": [{"text": text[:8000]}]},
        "taskType": task_type,
        "outputDimensionality": settings.embed_dims_gemini,
    }
    last_error = "Gemini embed failed"
    timeout = 8.0 if quick else 60.0
    attempts = 2 if quick else 20
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(attempts):
            key = _active_key("gemini")
            await _pace("gemini", key, GEMINI_RPM, quick=quick)
            response = await client.post(url, params={"key": key}, json=payload)
            wait = _handle_status("gemini", key, response.status_code, response.text, attempt)
            if wait is not None:
                last_error = "Gemini embed rate limited"
                if quick and wait > 0:
                    raise EmbedError(last_error)
                if wait:
                    await asyncio.sleep(wait)
                continue
            values = response.json().get("embedding", {}).get("values")
            if not values or len(values) != settings.embed_dims_gemini:
                raise EmbedError("Gemini embedding returned no vector")
            return [float(value) for value in values]
    raise EmbedError(last_error)


async def embed_query(text: str) -> tuple[list[float], str]:
    nvidia_error: Exception | None = None
    if get_settings().nvidia_key_list:
        try:
            return await embed_nvidia_text(text, task_type="RETRIEVAL_QUERY"), "nvidia"
        except EmbedError as exc:
            nvidia_error = exc
    if get_settings().gemini_key_list:
        try:
            return await embed_gemini_text(text, task_type="RETRIEVAL_QUERY"), "gemini"
        except EmbedError as exc:
            raise EmbedError(str(nvidia_error or exc)) from exc
    raise EmbedError(str(nvidia_error) if nvidia_error else "no embedding keys")
