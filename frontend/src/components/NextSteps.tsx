import { Skeleton } from "./Skeleton";
import {
  ITINERARY_SLOTS,
  NEARBY_KM,
  NEARBY_KM_OPTIONS,
  formatKm,
  nextStepSearches,
  placeBlurb,
  type NearbyKm,
  type Place,
} from "../types";

type Props = {
  place: Place;
  origin?: Place;
  nearby?: Place[];
  nearbyLoading?: boolean;
  nearbyKm?: number;
  compact?: boolean;
  onPick: (query: string) => void;
  onFocus?: (place: Place) => void;
  onOpen?: (place: Place) => void;
  onKmChange?: (km: NearbyKm) => void;
};

export function NextSteps({
  place,
  origin,
  nearby = [],
  nearbyLoading = false,
  nearbyKm = NEARBY_KM,
  compact = false,
  onPick,
  onFocus,
  onKmChange,
  onOpen,
}: Props) {
  const start = origin || place;
  const plan = [start, ...nearby.filter((item) => item.att_id !== start.att_id)];
  const hasCoords = start.lat != null && start.lng != null;
  return (
    <section className={compact ? "next-steps is-compact" : "next-steps"} data-component="NextSteps">
      <h2>{compact ? "จุดแวะต่อใกล้ๆ" : "แนะนำต่อ — จุดใกล้ๆ ที่พักและแผน"}</h2>
      {compact ? null : (
        <p>
          ค่าเริ่ม {NEARBY_KM} กม. รอบ «{start.name_th}» เพราะหลังถึงจุดนี้ คนมักไม่ขับไกลทันที
          กดจุดเพื่อดูว่ามีอะไร จากนั้นขยายรัศมีได้ถ้ายังไม่เจอที่ถูกใจ
        </p>
      )}
      <div className="radius-picks" role="group" aria-label="รัศมีจุดใกล้ๆ">
        <span>รัศมี</span>
        {NEARBY_KM_OPTIONS.map((km) => (
          <button
            key={km}
            type="button"
            aria-pressed={nearbyKm === km}
            onClick={() => onKmChange?.(km)}
          >
            {km} กม.
          </button>
        ))}
      </div>
      {nearbyLoading ? (
        <ol className="itinerary" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <Skeleton variant="title" height="3.2rem" />
            </li>
          ))}
        </ol>
      ) : !hasCoords ? (
        <p>จุดนี้ในฐานยังไม่มีพิกัด จึงค้นที่ใกล้ไม่ได้ กดปุ่มด้านล่างเพื่อค้นที่พักหรือจุดแวะต่อ</p>
      ) : plan.length > 1 ? (
        <ol className="itinerary">
          {plan.map((stop, index) => {
            const where = [stop.district, stop.province].filter(Boolean).join(" · ");
            const slot = index === 0 ? "ฐาน" : ITINERARY_SLOTS[index - 1] || `จุด ${index}`;
            const current = stop.att_id === start.att_id;
            const km = stop.distance_km ?? (stop.att_id === start.att_id ? 0 : null);
            const meta = [
              stop.type_label,
              where,
              km != null && stop.att_id !== start.att_id ? `${formatKm(km)} กม.` : "",
              current ? "กำลังดู" : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={stop.att_id}>
                <button
                  type="button"
                  className={current ? "is-current" : ""}
                  aria-current={current ? "true" : undefined}
                  title="ดูข้อมูลจุดนี้บนแผนที่ และใช้เป็นจุดเริ่มค้นใกล้ๆ"
                  onClick={() => onFocus?.(stop)}
                >
                  <span>{slot}</span>
                  <strong>{stop.name_th}</strong>
                  {meta ? <small>{meta}</small> : null}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p>
          ในรัศมี {nearbyKm} กม. รอบ «{start.name_th}» ยังไม่พบที่อื่นในฐาน ททท.
          {nearbyKm < NEARBY_KM_OPTIONS[NEARBY_KM_OPTIONS.length - 1]
            ? " ลองขยายรัศมี หรือกด «จุดแวะต่อ» เพื่อค้นจากมู้ดแทน"
            : " กด «จุดแวะต่อ» เพื่อค้นจากมู้ดแทน"}
        </p>
      )}
      {compact ? null : <StopBrief place={start} onOpen={onOpen} />}
      <div className="chips next">
        {nextStepSearches(place).map((chip) => (
          <button key={chip.q} type="button" onClick={() => onPick(chip.q)}>
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function StopBrief({ place, onOpen }: { place: Place; onOpen?: (place: Place) => void }) {
  const blurb = placeBlurb(place);
  const where = [place.district, place.province].filter(Boolean).join(" · ");
  return (
    <article className="stop-brief" data-component="StopBrief">
      <p className="stop-brief-kicker">
        {[place.type_label, where].filter(Boolean).join(" · ") || "ข้อมูลจาก ททท."}
      </p>
      <h3>{place.name_th}</h3>
      {blurb ? <p className="stop-brief-why">{blurb}</p> : (
        <p className="stop-brief-why">ฐาน ททท. ยังไม่มีคำอธิบายยาวของที่นี่ นอกจากชื่อ ที่อยู่ และข้อเท็จจริงด้านล่าง</p>
      )}
      <dl>
        <div>
          <dt>เวลาเปิด-ปิด</dt>
          <dd>{place.hours.text || place.hours.label}</dd>
        </div>
        <div>
          <dt>ค่าเข้าชม</dt>
          <dd>{place.fee.label}</dd>
        </div>
        {place.tel ? (
          <div>
            <dt>โทร</dt>
            <dd>
              <a className="tel" href={`tel:${place.tel}`}>
                {place.tel}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      {onOpen ? (
        <button type="button" className="stop-brief-open" onClick={() => onOpen(place)}>
          ดูรายละเอียด
        </button>
      ) : null}
    </article>
  );
}
