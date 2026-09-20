from __future__ import annotations

import math
from typing import Any

EARTH_KM = 6371.0
NEARBY_KM = 20.0
NEARBY_MAX_KM = 80.0
NEARBY_LIMIT = 8
NEARBY_WIDE_LIMIT = 12


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * EARTH_KM * math.asin(min(1.0, math.sqrt(a)))


def bounding_box(lat: float, lng: float, km: float) -> tuple[float, float, float, float]:
    lat_delta = km / 111.0
    cos_lat = max(0.01, abs(math.cos(math.radians(lat))))
    lng_delta = km / (111.0 * cos_lat)
    return lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta


def format_km(km: float) -> str:
    if km < 10:
        text = f"{km:.1f}".rstrip("0").rstrip(".")
        return text
    return str(int(round(km)))


def pick_nearby(
    lat: float,
    lng: float,
    rows: list[dict[str, Any]],
    *,
    km: float = NEARBY_KM,
    exclude_att_id: str | None = None,
    limit: int = NEARBY_LIMIT,
) -> list[dict[str, Any]]:
    scored: list[dict[str, Any]] = []
    for row in rows:
        att_id = str(row.get("att_id") or "")
        if not att_id or (exclude_att_id and att_id == exclude_att_id):
            continue
        try:
            other_lat = float(row["lat"])
            other_lng = float(row["lng"])
        except (KeyError, TypeError, ValueError):
            continue
        dist = haversine_km(lat, lng, other_lat, other_lng)
        if dist > km:
            continue
        scored.append({**row, "distance_km": dist})
    scored.sort(key=lambda item: float(item["distance_km"]))
    return scored[: max(0, limit)]
