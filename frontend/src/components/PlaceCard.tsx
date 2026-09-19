import { CHIANG_MAI, type Place } from "../types";

type Props = {
  place: Place;
  rank: number;
  rating: number;
  showScores: boolean;
  onVote: (rating: 1 | -1) => void;
  onUpload: () => void;
  onFavoriteCover: (imageId: string) => void;
  onOpen: () => void;
  onFocus: () => void;
  focused?: boolean;
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
  onOpen,
  onFocus,
  focused,
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
    <article
      className={focused ? "card is-focus" : "card"}
      data-component="PlaceCard"
      onClick={onFocus}
    >
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
        <span className="cover-num">#{rank}</span>
        <div className="cover-loc">
          {secondary ? <span className="cover-tag">เมืองรอง</span> : null}
          <span className="cover-pin">
            <PinIcon />
            {place.province}
          </span>
        </div>
        {cover ? (
          <button
            type="button"
            className="cover-fav"
            aria-pressed={cover.viewer_faved}
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteCover(cover.id);
            }}
          >
            <StarIcon />
            <strong>{cover.fav_count}</strong>
            <span>(Top Cover)</span>
          </button>
        ) : null}
      </div>
      <div className="card-body">
        <h3>
          <button
            type="button"
            className="card-title"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {place.name_th}
          </button>
        </h3>
        {place.district ? <p className="place-district">{place.district}</p> : null}
        {place.type_label ? <p className="place-meta">{place.type_label}</p> : null}
        <p className="why">
          <QuoteIcon />
          {place.why}
        </p>
        <div className="facts">
          <div className="fact-row">
            <ClockIcon />
            <span>
              เวลาเปิด-ปิด: <strong>{place.hours.label}</strong>
            </span>
          </div>
          <div className="fact-row">
            <TicketIcon />
            <span className={place.fee.status === "confirmed" ? "fee-ok" : "fee-unknown"}>
              {place.fee.status === "confirmed" ? place.fee.label : `ค่าเข้าชม: ${place.fee.label}`}
            </span>
          </div>
          {place.tel ? (
            <div className="fact-row">
              <a className="tel" href={`tel:${place.tel}`}>
                โทร {place.tel}
              </a>
            </div>
          ) : null}
          {callLine ? <div className="badge-unknown">{callLine}</div> : null}
        </div>
        {place.limitation ? <p className="limitation">{place.limitation}</p> : null}
        <div className="links" onClick={(e) => e.stopPropagation()}>
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
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          <div className="vibe-vote">
            <span className="vibe-ask">ตรง Vibe?</span>
            <button type="button" data-vote="1" aria-pressed={rating === 1} onClick={() => onVote(1)}>
              <ThumbUpIcon /> ตรง
            </button>
            <button
              type="button"
              data-vote="-1"
              aria-pressed={rating === -1}
              onClick={() => onVote(-1)}
            >
              <ThumbDownIcon /> ไม่ตรง
            </button>
          </div>
          <button type="button" className="upload-btn" onClick={onUpload}>
            <CamIcon /> +เพิ่มรูป
          </button>
          <button type="button" className="detail-btn" onClick={onOpen}>
            ดูรายละเอียด
          </button>
        </div>
      </div>
    </article>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="m12 3.2 2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.9 7.06 18.4l.94-5.5-4-3.9 5.53-.8L12 3.2Z"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.2 11.5C5.4 11.5 4 12.9 4 14.7S5.4 18 7.2 18s3.2-1.4 3.2-3.2c0-3.7-2.3-6.4-5.8-7.3l.7 2.2c1.1.5 1.9 1.4 1.9 2.8Zm9.6 0c-1.8 0-3.2 1.4-3.2 3.2S15 18 16.8 18s3.2-1.4 3.2-3.2c0-3.7-2.3-6.4-5.8-7.3l.7 2.2c1.1.5 1.9 1.4 1.9 2.8Z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11H7.5V11H11V6h2v7Z"
      />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22 10V6H2v4a2 2 0 0 1 0 4v4h20v-4a2 2 0 0 1 0-4Zm-9 7H4v-1.2A3.99 3.99 0 0 0 5 12a3.99 3.99 0 0 0-1-2.8V8h9v9Zm7 0h-5V8h5v1.2A3.99 3.99 0 0 0 19 12c0 1.1.4 2.1 1 2.8V17Z"
      />
    </svg>
  );
}

function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 21h4V9H2v12Zm20-11c0-1.1-.9-2-2-2h-6.3l1-4.7v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 7.9 6 8.4 6 9v10c0 1.1.9 2 2 2h9c.8 0 1.5-.5 1.8-1.2l3.1-7.2c.1-.2.1-.5.1-.8v-1.8Z"
      />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22 3h-4v12h4V3ZM2 14c0 1.1.9 2 2 2h6.3l-1 4.7v.3c0 .4.2.8.4 1.1l1.1 1.1 6.6-6.6c.4-.3.6-.8.6-1.4V5c0-1.1-.9-2-2-2H7.1C6.3 3 5.6 3.5 5.3 4.2L2.2 11.4c-.1.2-.1.5-.1.8V14Z"
      />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"
      />
    </svg>
  );
}
