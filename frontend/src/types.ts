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

function haversineKm(a: Place, b: Place): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return Number.POSITIVE_INFINITY;
  }
  const earthKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function itineraryOrder(places: Place[], startId?: string | null): Place[] {
  if (places.length <= 1) return places.slice();
  const remaining = places.slice();
  const startIndex = startId ? remaining.findIndex((item) => item.att_id === startId) : 0;
  const ordered = [remaining.splice(startIndex >= 0 ? startIndex : 0, 1)[0]];
  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((item, index) => {
      const distance = haversineKm(current, item);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return ordered;
}
