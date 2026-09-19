import { CHIANG_MAI, type Place } from "../types";
import { BaseModal } from "./BaseModal";
import { NextSteps } from "./NextSteps";

type Props = {
  place: Place | null;
  rating: number;
  onClose: () => void;
  onVote: (rating: 1 | -1) => void;
  onUpload: () => void;
  onFavorite: (imageId: string) => void;
  onNext: (query: string) => void;
};

function coverOf(place: Place) {
  return place.images.find((img) => img.is_cover) || place.images[0] || null;
}

export function PlaceDetailModal({
  place,
  rating,
  onClose,
  onVote,
  onUpload,
  onFavorite,
  onNext,
}: Props) {
  if (!place) return null;
  const cover = coverOf(place);
  const unknownFee = place.fee.status !== "confirmed";
  const unknownHours = place.hours.status !== "confirmed";
  const callLine =
    (unknownFee || unknownHours) && place.tel
      ? `กรุณาติดต่อ ${place.tel} ก่อนเดินทาง`
      : "";
  const mapUrl =
    place.lat != null && place.lng != null
      ? `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=15/${place.lat}/${place.lng}`
      : null;
  const location = [place.province, place.district].filter(Boolean).join(" · ");

  return (
    <BaseModal
      open
      size="wide"
      title={place.name_th}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="modal-btn ghost" onClick={onClose}>
            ปิด
          </button>
          <button type="button" className="modal-btn primary" onClick={onUpload}>
            เพิ่มรูป
          </button>
        </>
      }
    >
      <div className="place-sheet">
        {cover ? <img className="place-sheet-hero" src={cover.url} alt="" /> : null}
        <p className="place-sheet-kicker">
          {location}
          {place.province !== CHIANG_MAI ? " · จังหวัดรอง" : ""}
          {place.type_label ? ` · ${place.type_label}` : ""}
        </p>
        {place.highlight ? (
          <p className="place-sheet-highlight">{place.highlight}</p>
        ) : null}
        <section>
          <h3>ทำไมตรงมู้ด</h3>
          <p>{place.why}</p>
        </section>
        <section>
          <h3>ข้อมูลจาก ททท.</h3>
          <p className="place-sheet-detail">
            {place.detail || "ฐานยังไม่มีคำอธิบายยาวของที่นี่ นอกจากชื่อ ที่อยู่ และข้อเท็จจริงด้านล่าง"}
          </p>
        </section>
        <dl className="place-sheet-facts">
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
          {place.limitation ? (
            <div>
              <dt>ข้อจำกัด</dt>
              <dd>{place.limitation}</dd>
            </div>
          ) : null}
          {place.website ? (
            <div>
              <dt>เว็บไซต์</dt>
              <dd>
                <a href={place.website} target="_blank" rel="noreferrer">
                  {place.website}
                </a>
              </dd>
            </div>
          ) : null}
          {place.facebook ? (
            <div>
              <dt>Facebook</dt>
              <dd>
                <a href={place.facebook} target="_blank" rel="noreferrer">
                  {place.facebook}
                </a>
              </dd>
            </div>
          ) : null}
          {mapUrl ? (
            <div>
              <dt>แผนที่</dt>
              <dd>
                <a href={mapUrl} target="_blank" rel="noreferrer">
                  เปิดใน OpenStreetMap
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        {callLine ? <p className="badge-unknown">{callLine}</p> : null}
        <NextSteps compact place={place} onPick={onNext} />
        {place.images.length ? (
          <section>
            <h3>รูปจากนักท่องเที่ยว</h3>
            <div className="place-sheet-gallery">
              {place.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  className={img.is_cover ? "is-cover" : ""}
                  aria-pressed={img.viewer_faved}
                  onClick={() => onFavorite(img.id)}
                >
                  <img src={img.url} alt="" />
                  <span>{img.fav_count}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p>ยังไม่มีรูปในระบบ</p>
        )}
        <div className="vibe-vote">
          <span className="vibe-ask">ตรง Vibe?</span>
          <button type="button" data-vote="1" aria-pressed={rating === 1} onClick={() => onVote(1)}>
            ตรง
          </button>
          <button type="button" data-vote="-1" aria-pressed={rating === -1} onClick={() => onVote(-1)}>
            ไม่ตรง
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
