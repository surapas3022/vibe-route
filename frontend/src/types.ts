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
  viewer_owned?: boolean;
  moderation_status?: string;
};

export type Place = {
  att_id: string;
  name_th: string;
  province: string;
  district: string | null;
  type_label: string | null;
  why: string;
  detail?: string | null;
  highlight?: string | null;
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
  distance_km?: number | null;
  images: PlaceImage[];
};

export type MapPointKind = "result" | "origin" | "nearby";

export type MapPoint = {
  att_id: string;
  name_th: string;
  lat: number;
  lng: number;
  kind?: MapPointKind;
  distance_km?: number | null;
  type_label?: string | null;
  blurb?: string | null;
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

export type NearbyResponse = {
  origin: Place;
  km: number;
  places: Place[];
  map_points: MapPoint[];
};

export type HealthResponse = {
  assistant: AssistantStatus;
  embed_ready: boolean;
  listing_count: number;
  poc_region: string;
  embed_nvidia_count?: number;
  embed_gemini_count?: number;
};

export type SuggestResponse = {
  region: string;
  days: number;
  queries: Array<{ query: string; label: string; count: number }>;
  places: Array<{
    att_id: string;
    name_th: string;
    province: string;
    type_label?: string | null;
    likes: number;
  }>;
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
export const OPENING_CHAT_COPY = "กำลังเปิดแชทจากประวัติ";
export const EXPLAINING_COPY = "การ์ดด้านล่างมาจากฐานแล้ว กำลังอธิบายว่าทำไมตรงมู้ด";
export const CHIANG_MAI = "เชียงใหม่";

/** Keep in sync with backend/app/privacy.py. Redacts user-search PII only, not TAT listing fields. */
const MASK = "***";
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const PHONE_RE =
  /(?<!\d)(?:\+?66[-.\s]*(?:\(0\)[-.\s]*)?|0)(?:[689](?:[-.\s]?\d){8}|2(?:[-.\s]?\d){7}|[3-7]\d(?:[-.\s]?\d){6,7})(?!\d)/g;
const THAI_ID_FMT = /(?<!\d)[1-8]-\d{4}-\d{5}-\d{2}-\d(?!\d)/g;
const THAI_ID_DIGITS = /(?<!\d)[1-8]\d{12}(?!\d)/g;
const LINE_ID_RE = /(?:line\s*id|ไลน์(?:\s*ไอดี)?)[\s:]*@?[\w.\-]{3,32}/gi;
const MS_TITLE_RE = /นางสาว\s+[ก-๙A-Za-z]{2,20}|นางสาว[ก-๙A-Za-z]{2,8}/g;
const SPACED_TITLE_RE = /(?:นาย|นาง)\s+[ก-๙A-Za-z]{2,20}/g;
const EN_TITLE_RE = /\b(?:Mr|Mrs|Ms|Miss)\.?\s+[A-Za-z][A-Za-z'’\-]{1,30}\b/g;
const SELF_NAME_RE =
  /(?:ผมชื่อ|ฉันชื่อ|ดิฉันชื่อ|กระผมชื่อ|ชื่อ(?:ของ)?(?:ผม|ฉัน|ดิฉัน|กระผม)|ชื่อ(?:คือ|ว่า))\s*[ก-๙A-Za-z]{2,12}/g;

function thaiIdChecksum(digits: string): boolean {
  if (digits.length !== 13 || !/^\d+$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < 12; i += 1) total += Number(digits[i]) * (13 - i);
  const check = (11 - (total % 11)) % 10;
  return check === Number(digits[12]);
}

function maskThaiId(text: string): string {
  const replaceIfValid = (matched: string) => {
    const digits = matched.replace(/\D/g, "");
    return thaiIdChecksum(digits) ? MASK : matched;
  };
  return text.replace(THAI_ID_FMT, replaceIfValid).replace(THAI_ID_DIGITS, replaceIfValid);
}

export function maskQuery(text: string | null | undefined): string {
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  THAI_ID_FMT.lastIndex = 0;
  THAI_ID_DIGITS.lastIndex = 0;
  LINE_ID_RE.lastIndex = 0;
  MS_TITLE_RE.lastIndex = 0;
  SPACED_TITLE_RE.lastIndex = 0;
  EN_TITLE_RE.lastIndex = 0;
  SELF_NAME_RE.lastIndex = 0;
  const original = text || "";
  let masked = original;
  masked = masked.replace(EMAIL_RE, MASK);
  masked = masked.replace(PHONE_RE, MASK);
  masked = maskThaiId(masked);
  masked = masked.replace(LINE_ID_RE, MASK);
  masked = masked.replace(MS_TITLE_RE, MASK);
  masked = masked.replace(SPACED_TITLE_RE, MASK);
  masked = masked.replace(EN_TITLE_RE, MASK);
  masked = masked.replace(SELF_NAME_RE, MASK);
  if (masked === original) return original;
  return masked.split(/\s+/).filter(Boolean).join(" ");
}

/** TAT often stores ``www.example.com`` without a scheme; that href stays on our origin. */
export function externalHref(raw: string | null | undefined, kind?: "facebook"): string | null {
  const text = (raw || "").trim();
  if (!text || text === "-" || /^(javascript|data|vbscript|file):/i.test(text)) {
    return null;
  }
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  if (
    kind === "facebook" &&
    !text.includes(".") &&
    !text.includes("/") &&
    !/facebook|fb\.com/i.test(text)
  ) {
    const handle = text.replace(/^@/, "");
    return handle ? `https://www.facebook.com/${handle}` : null;
  }
  return `https://${text}`;
}

export const DEFAULT_REGION = "ภาคเหนือ";

export const POPULAR_SEARCHES = [
  { q: "อยากไปที่เงียบๆ สโลว์ไลฟ์ หลีกหนีความวุ่นวาย", label: "สโลว์ไลฟ์ เงียบ" },
  { q: "ที่เที่ยวอากาศหนาว ทะเลหมอก ดอยสูง", label: "หนาว ทะเลหมอก" },
  { q: "พาเด็กเที่ยวชุมชน ไม่ใช่วัดดังในเชียงใหม่", label: "ชุมชน พาเด็ก" },
  { q: "น้ำตกในป่า เดินชิลล์ ไม่ยาก", label: "น้ำตก เดินป่า" },
  { q: "วัดเชียงราย สงบ ไม่พลุกพล่าน", label: "วัดเชียงราย สงบ" },
  { q: "คาเฟ่วิวภูเขา ชนบท", label: "คาเฟ่ภูเขา" },
  { q: "ตลาดเช้า ของกินเหนือ", label: "ตลาดเช้า ของกิน" },
  { q: "ดูดาว ค้างคืนอากาศเย็น", label: "ดูดาว ค้างคืน" },
] as const;

export const DEMO_CHIPS = [
  { q: "เมืองเก่าอุทัยธานี ค่าเข้าชม", label: "ไม่มีค่าเข้าชมในฐาน" },
  { q: "คุ้มเจ้าบุรีรัตน์ ค่าเข้าชม", label: "มีค่าเข้าชม 60 บาท" },
  { q: "ทะเลภูเก็ต", label: "ผลว่าง (นอกภาค)" },
] as const;

export const ITINERARY_SLOTS = ["เช้า", "สาย", "บ่าย", "เย็น", "ค่ำ", "สำรอง"] as const;
export const NEARBY_KM = 20 as const;
export const NEARBY_KM_OPTIONS = [10, 20, 40, 60] as const;
export type NearbyKm = (typeof NEARBY_KM_OPTIONS)[number];

export function formatKm(km: number): string {
  if (km < 10) return km.toFixed(1).replace(/\.0$/, "");
  return String(Math.round(km));
}

export function placeBlurb(place: Place, maxLen = 180): string | null {
  const highlight = (place.highlight || "").trim();
  const detail = (place.detail || "").trim();
  const why = (place.why || "").trim();
  const text = highlight || detail || (why && !why.startsWith("ห่างจาก") ? why : "");
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function nextStepSearches(place: Place): Array<{ q: string; label: string }> {
  const where = [place.district, place.province].filter(Boolean).join(" ");
  const name = place.name_th;
  return [
    {
      q: `${name} โฮมสเตย์ ที่พักชุมชน ${where} แนะนำหน่อย`,
      label: "ที่พัก / โฮมสเตย์ใกล้ที่นี่",
    },
    {
      q: `แผนเที่ยว 1 วันแถว ${where} ต่อจาก ${name} เที่ยวยังไง`,
      label: "แผนเที่ยว 1 วันจากฐาน",
    },
    {
      q: `${name} ของกิน ตลาด อาหารพื้นบ้าน ${where} แนะนำหน่อย`,
      label: "ของกินแถวนี้",
    },
    {
      q: `จุดแวะถัดไปใกล้ ${name} ${where} น้ำตก วัด ชุมชน แนะนำหน่อย`,
      label: "จุดแวะต่อ",
    },
  ];
}
