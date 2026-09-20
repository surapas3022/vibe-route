import { useEffect, useState } from "react";
import { CHIANG_MAI, NEARBY_KM, externalHref, type NearbyKm, type Place, type PlaceImage } from "../types";
import { BaseModal } from "./BaseModal";
import { NextSteps } from "./NextSteps";

type Props = {
  place: Place | null;
  rating: number;
  onClose: () => void;
  onVote: (rating: 1 | -1) => void;
  onUpload: () => void;
  onFavorite: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onNext: (query: string) => void;
  onKmChange?: (km: NearbyKm) => void;
  onFocusPlace?: (place: Place) => void;
  origin?: Place;
  nearby?: Place[];
  nearbyLoading?: boolean;
  nearbyKm?: number;
  uploading?: boolean;
};

function coverOf(place: Place) {
  return place.images.find((img) => img.is_cover) || place.images[0] || null;
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

export function PlaceDetailModal({
  place,
  rating,
  onClose,
  onVote,
  onUpload,
  onFavorite,
  onDelete,
  onNext,
  onKmChange,
  onFocusPlace,
  origin,
  nearby,
  nearbyLoading,
  nearbyKm = NEARBY_KM,
  uploading,
}: Props) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  if (!place) return null;
  const cover = coverOf(place);
  const viewing = place.images.find((img) => img.id === viewingId) || null;
  const viewingIndex = viewing ? place.images.findIndex((img) => img.id === viewing.id) : -1;
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
  const websiteHref = externalHref(place.website);
  const facebookHref = externalHref(place.facebook, "facebook");
  const location = [place.province, place.district].filter(Boolean).join(" · ");

  return (
    <>
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
            <button type="button" className="modal-btn primary" onClick={onUpload} disabled={uploading}>
              {uploading ? "กำลังอัปโหลด…" : "เพิ่มรูป"}
            </button>
          </>
        }
      >
        <div className="place-sheet">
          {cover ? (
            <button
              type="button"
              className="place-sheet-hero-btn"
              onClick={() => setViewingId(cover.id)}
            >
              <img className="place-sheet-hero" src={cover.url} alt="" />
            </button>
          ) : null}
          {uploading ? (
            <p className="upload-status" aria-live="polite">
              กำลังอัปโหลดรูป กรุณารอสักครู่
            </p>
          ) : null}
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
            {websiteHref ? (
              <div>
                <dt>เว็บไซต์</dt>
                <dd>
                  <a href={websiteHref} target="_blank" rel="noreferrer">
                    {place.website}
                  </a>
                </dd>
              </div>
            ) : null}
            {facebookHref ? (
              <div>
                <dt>Facebook</dt>
                <dd>
                  <a href={facebookHref} target="_blank" rel="noreferrer">
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
          <NextSteps
            compact
            place={place}
            origin={origin}
            nearby={nearby}
            nearbyLoading={nearbyLoading}
            nearbyKm={nearbyKm}
            onPick={onNext}
            onKmChange={onKmChange}
            onFocus={onFocusPlace}
          />
          {place.images.length || uploading ? (
            <section>
              <h3>รูปจากนักท่องเที่ยว</h3>
              <div className="place-sheet-gallery">
                {place.images.map((img) => (
                  <div key={img.id} className={img.is_cover ? "gallery-item is-cover" : "gallery-item"}>
                    <button
                      type="button"
                      className="gallery-open"
                      onClick={() => setViewingId(img.id)}
                    >
                      <img src={img.url} alt="" />
                    </button>
                    <button
                      type="button"
                      className="gallery-fav"
                      aria-pressed={img.viewer_faved}
                      onClick={() => onFavorite(img.id)}
                    >
                      <StarIcon />
                      {img.fav_count}
                    </button>
                    {img.viewer_owned ? (
                      <button type="button" className="gallery-delete" onClick={() => onDelete(img.id)}>
                        ลบ
                      </button>
                    ) : null}
                  </div>
                ))}
                {uploading ? (
                  <div className="gallery-item is-uploading" aria-live="polite">
                    <span className="auth-spinner" aria-hidden="true" />
                    กำลังอัปโหลด
                  </div>
                ) : null}
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
      {viewing ? (
        <PhotoViewer
          images={place.images}
          current={viewing}
          index={viewingIndex}
          onClose={() => setViewingId(null)}
          onShow={setViewingId}
          onFavorite={onFavorite}
          onDelete={(imageId) => {
            onDelete(imageId);
            setViewingId(null);
          }}
        />
      ) : null}
    </>
  );
}

type ViewerProps = {
  images: PlaceImage[];
  current: PlaceImage;
  index: number;
  onClose: () => void;
  onShow: (imageId: string) => void;
  onFavorite: (imageId: string) => void;
  onDelete: (imageId: string) => void;
};

function PhotoViewer({
  images,
  current,
  index,
  onClose,
  onShow,
  onFavorite,
  onDelete,
}: ViewerProps) {
  const previous = index > 0 ? images[index - 1] : null;
  const next = index >= 0 && index < images.length - 1 ? images[index + 1] : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        onShow(previous.id);
      }
      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        onShow(next.id);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, onShow, previous, next]);

  return (
    <div className="photo-view" data-component="PhotoViewer">
      <button type="button" className="photo-view-backdrop" aria-label="ปิดรูป" onClick={onClose} />
      <figure className="photo-view-frame">
        <img src={current.url} alt="" />
        <figcaption>
          <span>
            {index + 1} / {images.length}
          </span>
          <button
            type="button"
            className="gallery-fav is-large"
            aria-pressed={current.viewer_faved}
            onClick={() => onFavorite(current.id)}
          >
            <StarIcon />
            {current.fav_count}
          </button>
          {current.viewer_owned ? (
            <button type="button" className="gallery-delete" onClick={() => onDelete(current.id)}>
              ลบ
            </button>
          ) : null}
          <button type="button" className="modal-btn ghost" onClick={onClose}>
            ปิด
          </button>
        </figcaption>
      </figure>
      {previous ? (
        <button type="button" className="photo-nav is-prev" onClick={() => onShow(previous.id)}>
          ก่อนหน้า
        </button>
      ) : null}
      {next ? (
        <button type="button" className="photo-nav is-next" onClick={() => onShow(next.id)}>
          ถัดไป
        </button>
      ) : null}
    </div>
  );
}
