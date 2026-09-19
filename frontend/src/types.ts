export type AssistantLevel = "ready" | "fallback" | "off";
export type FieldStatus = "confirmed" | "unknown";

export type AssistantStatus = {
  level: AssistantLevel;
  label: string;
  detail: string;
};

export type FactField = {
  status: FieldStatus;
  label: string;
  text: string | null;
};

export type PlaceImage = {
  id: string;
  att_id: string;
  url: string;
  fav_count: number;
  is_cover: boolean;
  viewer_faved: boolean;
  moderation_status?: string;
};

export type Place = {
  att_id: string;
  name_th: string;
  province: string;
  district: string | null;
  type_label: string | null;
  why: string;
  score_vector: number;
  score_ranked: number;
  fee: FactField;
  hours: FactField;
  tel: string | null;
  website: string | null;
  facebook: string | null;
  limitation: string | null;
  lat: number | null;
  lng: number | null;
  images: PlaceImage[];
};

export type MapPoint = {
  att_id: string;
  name_th: string;
  lat: number;
  lng: number;
};

export type SearchResponse = {
  chat_id: string;
  message_id: string;
  intro: string;
  assistant: AssistantStatus;
  prefer_secondary: boolean;
  secondary_count: number;
  places: Place[];
  map_points: MapPoint[];
  explain_pending?: boolean;
  retrieval_query?: string | null;
};

export type HealthResponse = {
  assistant: AssistantStatus;
  embed_ready: boolean;
  listing_count: number;
  poc_region: string;
  embed_nvidia_count?: number;
  embed_gemini_count?: number;
};

export type ChatSummary = {
  id: string;
  title: string;
  created_at: string;
  card_count?: number;
};

export type ChatTurn = {
  id: string;
  query: string;
  intro?: string;
};

export type StoredMessage = {
  id: string;
  query: string;
  intro: string;
  assistant: AssistantStatus;
  prefer_secondary: boolean;
  places: Place[];
  map_points: MapPoint[];
  created_at: string;
};

export const LOADING_COPY = "กำลังค้นจากฐาน ททท.";
export const EXPLAINING_COPY = "การ์ดด้านล่างมาจากฐานแล้ว กำลังอธิบายว่าทำไมตรงมู้ด";
export const CHIANG_MAI = "เชียงใหม่";
export const DEFAULT_REGION = "ภาคเหนือ";

export const DEMO_CHIPS = [
  { q: "อยากไปที่เงียบๆ สโลว์ไลฟ์ หลีกหนีความวุ่นวาย", label: "สโลว์ไลฟ์ เงียบ" },
  { q: "พาเด็กเที่ยวชุมชน ไม่ใช่วัดดังในเชียงใหม่", label: "ชุมชน ไม่ใช่วัดดังเชียงใหม่" },
  { q: "เมืองเก่าอุทัยธานี ค่าเข้าชม", label: "ไม่มีค่าเข้าชมในฐาน" },
  { q: "คุ้มเจ้าบุรีรัตน์ ค่าเข้าชม", label: "มีค่าเข้าชม 60 บาท" },
  { q: "ทะเลภูเก็ต", label: "ผลว่าง (นอกภาค)" },
] as const;
