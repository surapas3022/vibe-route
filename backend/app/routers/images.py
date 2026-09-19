from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app import db
from app.config import get_settings
from app.places import load_images
from app.deps import require_session
from app.schemas import PlaceImage

router = APIRouter()

ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 5 * 1024 * 1024


@router.get("/v1/places/{att_id}/images")
def list_images(att_id: str, session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        return {"images": []}
    return {"images": load_images([att_id], session_id).get(att_id, [])}


@router.post("/v1/places/{att_id}/images", response_model=PlaceImage, status_code=201)
async def upload_image(
    att_id: str,
    session_id: str = Depends(require_session),
    file: UploadFile = File(...),
):
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    listings = db.fetch_listings_by_ids([att_id])
    if not listings:
        raise HTTPException(status_code=404, detail="ไม่พบสถานที่")
    content_type = file.content_type or ""
    if content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="รับเฉพาะ jpg png webp")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="ไฟล์ใหญ่เกิน 5MB")

    settings = get_settings()
    image_id = str(uuid4())
    path = f"{att_id}/{image_id}{ALLOWED[content_type]}"
    client = db.get_supabase()
    client.storage.from_(settings.storage_bucket).upload(
        path,
        data,
        {"content-type": content_type, "upsert": "true"},
    )
    public = client.storage.from_(settings.storage_bucket).get_public_url(path)
    row = {
        "id": image_id,
        "att_id": att_id,
        "storage_path": path,
        "public_url": public,
        "uploader_session": session_id,
        "fav_count": 0,
        "moderation_status": "accepted",
    }
    client.table("place_images").insert(row).execute()
    packed = load_images([att_id], session_id).get(att_id, [])
    return packed[0] if packed else PlaceImage(id=image_id, att_id=att_id, url=public, is_cover=True)


@router.post("/v1/images/{image_id}/favorite", response_model=PlaceImage)
def toggle_favorite(image_id: str, session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    client = db.get_supabase()
    image = client.table("place_images").select("*").eq("id", image_id).execute()
    if not image.data:
        raise HTTPException(status_code=404, detail="ไม่พบรูป")
    row = image.data[0]
    existing = (
        client.table("image_favorites")
        .select("image_id")
        .eq("image_id", image_id)
        .eq("session_id", session_id)
        .execute()
    )
    if existing.data:
        client.table("image_favorites").delete().eq("image_id", image_id).eq("session_id", session_id).execute()
        client.table("place_images").update({"fav_count": max(0, int(row["fav_count"]) - 1)}).eq("id", image_id).execute()
    else:
        client.table("image_favorites").insert({"image_id": image_id, "session_id": session_id}).execute()
        client.table("place_images").update({"fav_count": int(row["fav_count"]) + 1}).eq("id", image_id).execute()
    packed = load_images([row["att_id"]], session_id).get(row["att_id"], [])
    found = next((item for item in packed if item.id == image_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="ไม่พบรูป")
    return found
