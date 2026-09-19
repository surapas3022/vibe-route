type Props = {
  query: string;
  continuing: boolean;
  lastVibe: string;
  onQuery: (value: string) => void;
  onSubmit: () => void;
};

function clipVibe(text: string): string {
  const clean = text.trim();
  if (clean.length <= 42) return clean;
  return clean.slice(0, 42) + "…";
}

export function VibeComposer({ query, continuing, lastVibe, onQuery, onSubmit }: Props) {
  return (
    <div className="composer-wrap">
      {continuing ? (
        <p className="composer-hint">
          {lastVibe
            ? `กำลังต่อจาก «${clipVibe(lastVibe)}» พิมพ์เพิ่มได้ ระบบยึดมู้ดเดิม`
            : "พิมพ์ต่อในแชทนี้ได้ ระบบยึดมู้ดเดิมแล้วค้นใหม่ตามที่เพิ่ม"}
        </p>
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
          required
          autoComplete="off"
          placeholder={
            continuing
              ? "เช่น เอาเชียงราย หรือ ไม่เอาวัดดัง"
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
