from __future__ import annotations

import re

MASK = "***"

# User-query PII only. Do not run this on TAT listing fields (tel, hours, fees).
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(
    r"""
    (?<!\d)
    (?:
        \+?66[-.\s]*(?:\(0\)[-.\s]*)?
        |
        0
    )
    (?:
        [689](?:[-.\s]?\d){8}
        |
        2(?:[-.\s]?\d){7}
        |
        [3-7]\d(?:[-.\s]?\d){6,7}
    )
    (?!\d)
    """,
    re.VERBOSE,
)
_THAI_ID_FMT = re.compile(r"(?<!\d)[1-8]-\d{4}-\d{5}-\d{2}-\d(?!\d)")
_THAI_ID_DIGITS = re.compile(r"(?<!\d)[1-8]\d{12}(?!\d)")
_LINE_ID = re.compile(
    r"(?:line\s*id|ไลน์(?:\s*ไอดี)?)[\s:]*@?[\w.\-]{3,32}",
    re.I,
)
_MS_TITLE = re.compile(r"นางสาว\s+[ก-๙A-Za-z]{2,20}|นางสาว[ก-๙A-Za-z]{2,8}")
_SPACED_TITLE = re.compile(r"(?:นาย|นาง)\s+[ก-๙A-Za-z]{2,20}")
_EN_TITLE = re.compile(r"\b(?:Mr|Mrs|Ms|Miss)\.?\s+[A-Za-z][A-Za-z'’\-]{1,30}\b")
_SELF_NAME = re.compile(
    r"(?:ผมชื่อ|ฉันชื่อ|ดิฉันชื่อ|กระผมชื่อ|ชื่อ(?:ของ)?(?:ผม|ฉัน|ดิฉัน|กระผม)|ชื่อ(?:คือ|ว่า))\s*[ก-๙A-Za-z]{2,12}"
)


def _thai_id_checksum(digits: str) -> bool:
    if len(digits) != 13 or not digits.isdigit():
        return False
    total = sum(int(digits[index]) * (13 - index) for index in range(12))
    check = (11 - (total % 11)) % 10
    return check == int(digits[12])


def _mask_thai_id(text: str) -> str:
    def fmt(match: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", match.group(0))
        return MASK if _thai_id_checksum(digits) else match.group(0)

    def raw(match: re.Match[str]) -> str:
        return MASK if _thai_id_checksum(match.group(0)) else match.group(0)

    text = _THAI_ID_FMT.sub(fmt, text)
    return _THAI_ID_DIGITS.sub(raw, text)


def mask_query(text: str | None) -> str:
    """Redact phones, emails, IDs, and titled/self-identified names from a user search."""
    original = text or ""
    masked = original
    masked = _EMAIL.sub(MASK, masked)
    masked = _PHONE.sub(MASK, masked)
    masked = _mask_thai_id(masked)
    masked = _LINE_ID.sub(MASK, masked)
    masked = _MS_TITLE.sub(MASK, masked)
    masked = _SPACED_TITLE.sub(MASK, masked)
    masked = _EN_TITLE.sub(MASK, masked)
    masked = _SELF_NAME.sub(MASK, masked)
    if masked == original:
        return original
    return " ".join(masked.split())
