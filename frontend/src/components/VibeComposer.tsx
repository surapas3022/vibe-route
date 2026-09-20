type Props = {
  query: string;
  continuing: boolean;
  lastVibe: string;
  onQuery: (value: string) => void;
  onSubmit: () => void;
  suggestions?: ReadonlyArray<{ q: string; label: string }>;
  suggestionLabel?: string;
  onSuggest?: (query: string) => void;
  nextSteps?: ReadonlyArray<{ q: string; label: string }>;
  onNextStep?: (query: string) => void;
};

function clipVibe(text: string): string {
  const clean = text.trim();
  if (clean.length <= 42) return clean;
  return clean.slice(0, 42) + "…";
}

export function VibeComposer({
  query,
  continuing,
  lastVibe,
  onQuery,
  onSubmit,
  suggestions = [],
  suggestionLabel = "คำค้นหายอดนิยม",
  onSuggest,
  nextSteps = [],
  onNextStep,
}: Props) {
  return (
    <div className="composer-wrap">
      {continuing ? (
        <p className="composer-hint">
          {lastVibe
            ? `กำลังต่อจาก «${clipVibe(lastVibe)}» พิมพ์แผน ที่พัก หรือของกินได้ หรือกดค้นต่อว่างๆ เพื่อใช้มู้ดเดิมกับตัวกรองปัจจุบัน`
            : "พิมพ์ต่อในแชทนี้ได้ ระบบยึดมู้ดเดิมแล้วค้นใหม่ตามที่เพิ่ม"}
        </p>
      ) : null}
      {nextSteps.length ? (
        <div className="composer-popular">
          <p className="chips-label">แนะนำต่อ — แผน / ที่พัก</p>
          <div className="chips next">
            {nextSteps.map((chip) => (
              <button key={chip.q} type="button" onClick={() => onNextStep?.(chip.q)}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="composer-popular">
          <p className="chips-label">{suggestionLabel}</p>
          <div className="chips popular">
            {suggestions.map((chip) => (
              <button key={chip.q} type="button" onClick={() => onSuggest?.(chip.q)}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <form
        className="composer"
        data-component="VibeComposer"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          name="query"
          required={!continuing}
          autoComplete="off"
          placeholder={
            continuing
              ? lastVibe
                ? "ว่างไว้แล้วกดค้นต่อได้ ระบบยึดมู้ดเดิม"
                : "เช่น ที่พักใกล้ที่นี่ หรือ แผนเที่ยว 1 วัน"
              : "เช่น อยากไปที่เงียบๆ สโลว์ไลฟ์ หลีกหนีความวุ่นวาย"
          }
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button type="submit">{continuing ? "ค้นต่อ" : "ค้นหา"}</button>
      </form>
    </div>
  );
}
