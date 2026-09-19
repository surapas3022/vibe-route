import type { HealthResponse } from "../types";

type Props = {
  open: boolean;
  apiBase: string;
  showScores: boolean;
  lastRequest: string;
  lastResponse: string;
  health: HealthResponse | null;
  onApiBase: (value: string) => void;
  onShowScores: (value: boolean) => void;
};

export function TeamPanel({
  open,
  apiBase,
  showScores,
  lastRequest,
  lastResponse,
  health,
  onApiBase,
  onShowScores,
}: Props) {
  return (
    <section className={open ? "team open" : "team"} data-component="TeamPanel">
      <h2>สำหรับทีมงาน</h2>
      <p className="meta">
        จอหลักห้ามโชว์ชื่อโมเดล HTTP หรือคะแนนเวกเตอร์ ค่าด้านล่างสำหรับดีบักตอนเดโม
      </p>
      <div className="team-grid">
        <label>
          API base ตอนรัน
          <input
            value={apiBase}
            placeholder="ว่าง = โดเมนเดียวกับหน้านี้"
            onChange={(e) => onApiBase(e.target.value)}
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showScores}
            onChange={(e) => onShowScores(e.target.checked)}
          />
          โชว์ score_vector / score_ranked บนการ์ด
        </label>
      </div>
      {health ? (
        <p className="meta">
          listing_count {health.listing_count} · nvidia {health.embed_nvidia_count ?? "—"} · gemini{" "}
          {health.embed_gemini_count ?? "—"} · embed_ready {String(health.embed_ready)}
        </p>
      ) : null}
      <p className="meta">คำขอล่าสุด</p>
      <pre>{lastRequest}</pre>
      <p className="meta">response ล่าสุด</p>
      <pre>{lastResponse}</pre>
    </section>
  );
}
