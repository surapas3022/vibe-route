from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.deps import require_session
from app.schemas import FeedbackRequest, FeedbackResponse

router = APIRouter()


@router.post("/v1/feedback", response_model=FeedbackResponse)
def feedback(body: FeedbackRequest, session_id: str = Depends(require_session)):
    if not db.supabase_configured():
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่า Supabase")
    db.get_supabase().table("feedback").upsert(
        {
            "message_id": body.message_id,
            "att_id": body.att_id,
            "session_id": session_id,
            "rating": body.rating,
        }
    ).execute()
    return FeedbackResponse(ok=True, att_id=body.att_id, rating=body.rating)
