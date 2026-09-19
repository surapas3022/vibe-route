from __future__ import annotations

import re

HOUR_PLACEHOLDERS = {
    "",
    "-",
    "n/a",
    "N/A",
    "วันและเวลาเปิด-ปิดทำการของสถานที่",
}

TEL_PLACEHOLDERS = {"", "-", "0"}


def _blank(value: object) -> bool:
    return value is None or str(value).strip() in {"", "None"}


def parse_location(raw: object) -> tuple[float | None, float | None]:
    if _blank(raw):
        return None, None
    text = str(raw).strip()
    if text.startswith("http"):
        return None, None
    parts = [part.strip() for part in text.split(",")]
    if len(parts) != 2:
        return None, None
    try:
        lat = float(parts[0])
        lng = float(parts[1])
    except ValueError:
        return None, None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, None
    return lat, lng


def usable_tel(raw: object) -> str | None:
    if _blank(raw):
        return None
    text = str(raw).strip()
    if text in TEL_PLACEHOLDERS:
        return None
    return text


def fee_field(raw: object, kid_raw: object = None) -> dict:
    if _blank(raw):
        return {
            "status": "unknown",
            "label": "ยังไม่มีข้อมูลค่าเข้าชมในระบบ",
            "text": None,
        }
    text = str(raw).strip()
    kid = None if _blank(kid_raw) else str(kid_raw).strip()
    if text in {"0", "0.0", "0.00"}:
        label = "ฟรี (ตามฐาน TAT)"
        if kid and kid not in {"0", "0.0", "0.00"}:
            label = f"ฟรีผู้ใหญ่ (ตามฐาน TAT) · เด็ก {kid} บาท"
        return {"status": "confirmed", "label": label, "text": text}
    if re.fullmatch(r"\d+(\.\d+)?", text):
        label = f"{text} บาท (ตามฐาน TAT)"
        if kid:
            label = f"ผู้ใหญ่ {text} บาท · เด็ก {kid} บาท (ตามฐาน TAT)"
        return {"status": "confirmed", "label": label, "text": text}
    return {"status": "confirmed", "label": f"{text} (ตามฐาน TAT)", "text": text}


def hours_field(raw: object) -> dict:
    if _blank(raw):
        return {
            "status": "unknown",
            "label": "ยังไม่มีข้อมูลเวลาเปิดปิดในระบบ",
            "text": None,
        }
    text = " ".join(str(raw).split())
    if text in HOUR_PLACEHOLDERS or "วันและเวลาเปิด-ปิด" in text:
        return {
            "status": "unknown",
            "label": "ยังไม่มีข้อมูลเวลาเปิดปิดในระบบ",
            "text": None,
        }
    return {"status": "confirmed", "label": text, "text": text}


def snippet_why(
    name: str,
    province: str,
    type_label: str | None,
    detail: str | None,
    *,
    limit: int = 180,
) -> str:
    clip = re.sub(r"\s+", " ", (detail or "").strip())[:limit]
    kind = type_label or "แหล่งท่องเที่ยว"
    if clip:
        return f"{name} ที่{province} เป็น{kind} — {clip}"
    return f"{name} ที่{province} เป็น{kind} ตามข้อมูล ททท."


def clean_text(raw: object) -> str | None:
    if _blank(raw):
        return None
    text = str(raw).strip()
    return text or None
