import type { ChatSummary } from "../types";

type Props = {
  chats: ChatSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (chat: ChatSummary) => void;
  onDeleteAll: () => void;
};

function relativeTimeTh(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return "เมื่อครู่นี้";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "เมื่อวาน";
  if (day < 7) return `${day} วันที่แล้ว`;
  return new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function ChatIcon() {
  return (
    <svg className="history-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export function ChatHistory({ chats, activeId, onSelect, onNew, onDelete, onDeleteAll }: Props) {
  return (
    <aside className="history" data-component="ChatHistory">
      <div className="history-head">
        <h2>
          <ChatIcon />
          Chat History
        </h2>
        <button type="button" className="history-new" onClick={onNew}>
          <span aria-hidden>+</span> New Vibe
        </button>
      </div>
      <ul className="history-list">
        {chats.length === 0 ? (
          <li className="empty-history">ยังไม่มีประวัติในเซสชันนี้</li>
        ) : (
          chats.map((chat) => {
            const count = chat.card_count ?? 0;
            return (
              <li key={chat.id} className="history-item">
                <button
                  type="button"
                  className="history-open"
                  aria-current={chat.id === activeId ? "true" : undefined}
                  onClick={() => onSelect(chat.id)}
                >
                  <span className="history-title">
                    <ChatIcon />
                    <span>{chat.title || "แชท"}</span>
                  </span>
                  <span className="history-meta">
                    <small>{relativeTimeTh(chat.created_at)}</small>
                    <span className="history-cards">
                      {count} Card{count === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="history-delete"
                  aria-label={"เอาแชทออกจากประวัติ " + (chat.title || "")}
                  onClick={() => onDelete(chat)}
                >
                  ×
                </button>
              </li>
            );
          })
        )}
      </ul>
      {chats.length ? (
        <button type="button" className="history-clear" onClick={onDeleteAll}>
          เอาออกทั้งหมด
        </button>
      ) : null}
    </aside>
  );
}
