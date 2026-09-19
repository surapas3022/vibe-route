from __future__ import annotations

RECENT_FOLLOWUPS = 3


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def retrieval_query(current: str, prior: list[str]) -> str:
    """Turn a follow-up plus earlier turns into one standalone retrieval query.

    Keeps the first vibe in the chat and the latest refinements. The original
    user text is still what we store; this string is only for embed/keyword.
    """
    current_text = _clean(current)
    history = [_clean(item) for item in prior if _clean(item)]
    if not current_text:
        return " ".join(history)
    if not history:
        return current_text

    first = history[0]
    recent = [item for item in history[1:][-RECENT_FOLLOWUPS:] if item]
    parts: list[str] = []
    for item in [first, *recent, current_text]:
        if item and item not in parts:
            parts.append(item)
    return " ".join(parts)
