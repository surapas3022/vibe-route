from __future__ import annotations

import json
from pathlib import Path

from bs4 import BeautifulSoup

from app import facts

ACTIVE_STATUS = {"1", "1.0"}


def _text(value: object) -> str:
    if value is None:
        return ""
    html = str(value)
    if "<" in html:
        return " ".join(BeautifulSoup(html, "html.parser").get_text(" ", strip=True).split())
    return " ".join(html.split())


def load_records(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return data
    return data[list(data.keys())[0]]


def prepare_row(raw: dict, region: str) -> dict | None:
    status = raw.get("STATUS_DATA")
    if status is not None and str(status).strip() not in ACTIVE_STATUS:
        return None
    att_id = str(raw.get("ATT_ID") or "").strip()
    if not att_id:
        return None
    name = _text(raw.get("ATT_NAME_TH"))
    if not name or name.lower() == "test":
        return None
    if str(raw.get("REGION_NAME_TH") or "") != region:
        return None
    detail = _text(raw.get("ATT_DETAIL_TH"))
    if not detail:
        return None
    lat, lng = facts.parse_location(raw.get("ATT_LOCATION"))
    highlight = _text(raw.get("ATT_HILIGHT"))
    type_label = facts.clean_text(raw.get("ATT_TYPE_LABEL"))
    province = facts.clean_text(raw.get("PROVINCE_NAME_TH")) or "ไม่ระบุ"
    embed_text_value = " | ".join(
        part for part in [name, type_label or "", province, detail, highlight] if part
    )
    return {
        "att_id": att_id,
        "name_th": name,
        "province": province,
        "district": facts.clean_text(raw.get("DISTRICT_NAME_TH")),
        "region": region,
        "type_label": type_label,
        "detail_clean": detail,
        "highlight": highlight or None,
        "fee_th": None if raw.get("ATT_FEE_TH") in (None, "") else str(raw.get("ATT_FEE_TH")).strip(),
        "fee_kid": None if raw.get("ATT_FEE_TH_KID") in (None, "") else str(raw.get("ATT_FEE_TH_KID")).strip(),
        "hours_raw": facts.clean_text(raw.get("ATT_START_END")),
        "tel": facts.usable_tel(raw.get("ATT_TEL")),
        "website": facts.clean_text(raw.get("ATT_WEBSITE")),
        "facebook": facts.clean_text(raw.get("ATT_FACEBOOK")),
        "limitation": _text(raw.get("ATT_MARKET_LIMITATION")) or None,
        "lat": lat,
        "lng": lng,
        "search_text": f"{name} {province} {type_label or ''} {detail}",
        "embed_text": embed_text_value[:8000],
    }
