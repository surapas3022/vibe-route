from fastapi import APIRouter, HTTPException

from app import db
from app.config import get_settings
from app.llm import health_assistant
from app.regions import normalize_region
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/v1/health", response_model=HealthResponse)
def health():
    settings = get_settings()
    try:
        count = db.listing_count(settings.poc_region)
        nvidia_n = db.embedded_count(settings.poc_region, column="embedding_nvidia")
        gemini_n = db.embedded_count(settings.poc_region, column="embedding_gemini")
    except Exception:
        count = 0
        nvidia_n = 0
        gemini_n = 0
    return HealthResponse(
        assistant=health_assistant(),
        embed_ready=nvidia_n > 0 or gemini_n > 0,
        listing_count=count,
        poc_region=settings.poc_region,
        embed_nvidia_count=nvidia_n,
        embed_gemini_count=gemini_n,
    )


@router.get("/v1/regions")
def regions():
    if not db.supabase_configured():
        return {"regions": []}
    try:
        return {"regions": db.region_counts()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="อ่านรายการภาคไม่สำเร็จ") from exc


@router.get("/v1/provinces")
def provinces(region: str | None = None):
    """List provinces. `region` is TAT Thai name, e.g. ภาคเหนือ. `North` is accepted."""
    settings = get_settings()
    if not db.supabase_configured():
        return {"provinces": []}
    try:
        return {"provinces": db.province_counts(normalize_region(region, default=settings.poc_region))}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="อ่านรายการจังหวัดไม่สำเร็จ") from exc


