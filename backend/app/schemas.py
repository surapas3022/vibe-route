from typing import Literal

from pydantic import BaseModel, Field


AssistantLevel = Literal["ready", "fallback", "off"]
FieldStatus = Literal["confirmed", "unknown"]


class AssistantStatus(BaseModel):
    level: AssistantLevel
    label: str
    detail: str


class FactField(BaseModel):
    status: FieldStatus
    label: str
    text: str | None = None


class PlaceImage(BaseModel):
    id: str
    att_id: str
    url: str
    fav_count: int = 0
    is_cover: bool = False
    viewer_faved: bool = False
    moderation_status: Literal["accepted", "pending", "rejected"] = "accepted"


class Place(BaseModel):
    att_id: str
    name_th: str
    province: str
    district: str | None = None
    type_label: str | None = None
    why: str
    score_vector: float
    score_ranked: float
    fee: FactField
    hours: FactField
    tel: str | None = None
    website: str | None = None
    facebook: str | None = None
    limitation: str | None = None
    lat: float | None = None
    lng: float | None = None
    images: list[PlaceImage] = Field(default_factory=list)


class MapPoint(BaseModel):
    att_id: str
    name_th: str
    lat: float
    lng: float


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    region: str | None = None
    province: str | None = None
    prefer_secondary: bool = True
    chat_id: str | None = None


class SearchResponse(BaseModel):
    chat_id: str
    message_id: str
    intro: str
    assistant: AssistantStatus
    prefer_secondary: bool
    secondary_count: int
    places: list[Place]
    map_points: list[MapPoint]
    explain_pending: bool = False
    retrieval_query: str | None = None


class HealthResponse(BaseModel):
    assistant: AssistantStatus
    embed_ready: bool
    listing_count: int
    poc_region: str
    embed_nvidia_count: int = 0
    embed_gemini_count: int = 0


class FeedbackRequest(BaseModel):
    message_id: str
    att_id: str
    rating: Literal[1, -1]


class FeedbackResponse(BaseModel):
    ok: bool
    att_id: str
    rating: Literal[1, -1]
