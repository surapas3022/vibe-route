from fastapi import APIRouter, Depends, Query

from app import db
from app.config import get_settings
from app.deps import require_session
from app.regions import normalize_region
from app.schemas import SuggestResponse, TrendPlace, TrendQuery
from app.trends import TREND_DAYS

router = APIRouter()


@router.get("/v1/suggest", response_model=SuggestResponse)
def suggest(
    region: str | None = Query(default=None),
    session_id: str = Depends(require_session),
):
    del session_id
    settings = get_settings()
    chosen = normalize_region(region, default=settings.poc_region)
    if not db.supabase_configured():
        return SuggestResponse(region=chosen, days=TREND_DAYS, queries=[], places=[])
    try:
        stats = db.region_trends(chosen)
    except Exception:
        stats = {"region": chosen, "days": TREND_DAYS, "queries": [], "places": []}
    return SuggestResponse(
        region=str(stats.get("region") or chosen),
        days=int(stats.get("days") or TREND_DAYS),
        queries=[TrendQuery.model_validate(item) for item in stats.get("queries") or []],
        places=[TrendPlace.model_validate(item) for item in stats.get("places") or []],
    )
