import { CHIANG_MAI, type Place } from "../types";

type Props = {
  place: Place;
  rank: number;
  rating: number;
  showScores: boolean;
  onVote: (rating: 1 | -1) => void;
  onUpload: () => void;
  onFavoriteCover: (imageId: string) => void;
};

function coverOf(place: Place) {
  return place.images.find((img) => img.is_cover) || place.images[0] || null;
}

export function PlaceCard({
  place,
  rank,
  rating,
  showScores,
  onVote,
  onUpload,
  onFavoriteCover,
}: Props) {
  const cover = coverOf(place);
  const unknownFee = place.fee.status !== "confirmed";
  const unknownHours = place.hours.status !== "confirmed";
  const callLine =
    (unknownFee || unknownHours) && place.tel
      ? `กรุณาติดต่อ ${place.tel} ก่อนเดินทาง`
      : "";
  const secondary = place.province !== CHIANG_MAI;

  return (
    <article className="card" data-component="PlaceCard">
      <div className="cover">
        {cover ? (
          <img src={cover.url} alt="" />
        ) : (
          <span className="cover-copy">
            <strong>
              {place.province}
              {secondary ? " · จังหวัดรอง" : ""}
            </strong>
            <span>ยังไม่มีรูปในระบบ — อัปโหลดได้จากปุ่มด้านล่าง</span>
          </span>
        )}
        <span className="cover-num">{rank}</span>
        {secondary ? <span className="cover-tag">จังหวัดรอง</span> : null}
      </div>
      <div className="card-body">
        <h3>{place.name_th}</h3>
        <p className="place-meta">
          {place.province}
          {place.district ? ` · ${place.district}` : ""}
        </p>
        {place.type_label ? <span className="type">{place.type_label}</span> : null}
        <p className="why">{place.why}</p>
        <div className="facts">
          <div className={place.fee.status === "confirmed" ? "badge-ok" : "badge-unknown"}>
            ค่าเข้าชม · {place.fee.label}
          </div>
          <div className={place.hours.status === "confirmed" ? "badge-ok" : "badge-unknown"}>
            เวลาเปิดปิด · {place.hours.label}
          </div>
          {place.tel ? (
            <div>
              <a className="tel" href={`tel:${place.tel}`}>
                โทร {place.tel}
              </a>
            </div>
          ) : null}
          {callLine ? <div className="badge-unknown">{callLine}</div> : null}
        </div>
        {place.limitation ? <p className="limitation">{place.limitation}</p> : null}
        <div className="links">
          {place.website ? (
            <a href={place.website} target="_blank" rel="noreferrer">
              เว็บไซต์
            </a>
          ) : null}
          {place.facebook ? (
            <a href={place.facebook} target="_blank" rel="noreferrer">
              Facebook
            </a>
          ) : null}
        </div>
        {showScores ? (
          <p className="meta">
            score_vector {place.score_vector} · score_ranked {place.score_ranked}
          </p>
        ) : null}
        <div className="actions">
          <button type="button" data-vote="1" aria-pressed={rating === 1} onClick={() => onVote(1)}>
            ตรง
          </button>
          <button
            type="button"
            data-vote="-1"
            aria-pressed={rating === -1}
            onClick={() => onVote(-1)}
          >
            ไม่ตรง
          </button>
          <button type="button" onClick={onUpload}>
            เพิ่มรูป
          </button>
          {cover ? (
            <button
              type="button"
              aria-pressed={cover.viewer_faved}
              onClick={() => onFavoriteCover(cover.id)}
            >
              ถูกใจรูปปก
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
