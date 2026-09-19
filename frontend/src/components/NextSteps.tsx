import { ITINERARY_SLOTS, itineraryOrder, nextStepSearches, type Place } from "../types";

type Props = {
  place: Place;
  places?: Place[];
  compact?: boolean;
  onPick: (query: string) => void;
  onFocus?: (attId: string) => void;
};

export function NextSteps({ place, places = [], compact = false, onPick, onFocus }: Props) {
  const plan = compact ? [] : itineraryOrder(places, place.att_id);
  return (
    <section className={compact ? "next-steps is-compact" : "next-steps"} data-component="NextSteps">
      <h2>{compact ? "แนะนำต่อ" : "แนะนำต่อ — แผนและที่พัก"}</h2>
      {compact ? null : (
        <p>
          จาก «{place.name_th}» เรียงจุดแวะจากผลนี้ ไม่ได้คิดเวลาเดินทางให้ กดค้นที่พักหรือของกินจากฐาน ททท. ไม่ได้จองโรงแรมให้
        </p>
      )}
      {plan.length > 1 ? (
        <ol className="itinerary">
          {plan.map((stop, index) => {
            const where = [stop.district, stop.province].filter(Boolean).join(" · ");
            const slot = ITINERARY_SLOTS[index] || `จุด ${index + 1}`;
            return (
              <li key={stop.att_id}>
                <button
                  type="button"
                  className={stop.att_id === place.att_id ? "is-current" : ""}
                  onClick={() => onFocus?.(stop.att_id)}
                >
                  <span>{slot}</span>
                  <strong>{stop.name_th}</strong>
                  {where ? <small>{where}</small> : null}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
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
