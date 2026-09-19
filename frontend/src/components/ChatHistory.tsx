import type { ChatSummary } from "../types";

type Props = {
  chats: ChatSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (chat: ChatSummary) => void;
  onDeleteAll: () => void;
};

export function ChatHistory({ chats, activeId, onSelect, onDelete, onDeleteAll }: Props) {
  return (
    <aside className="history" data-component="ChatHistory">
      <div className="history-head">
        <h2>ประวัติ</h2>
        {chats.length ? (
          <button type="button" className="history-clear" onClick={onDeleteAll}>
            เอาออกทั้งหมด
          </button>
        ) : null}
      </div>
      <ul className="history-list">
        {chats.length === 0 ? (
          <li className="empty-history">ยังไม่มีประวัติในเซสชันนี้</li>
        ) : (
          chats.map((chat) => (
            <li key={chat.id} className="history-item">
              <button
                type="button"
                className="history-open"
                aria-current={chat.id === activeId ? "true" : undefined}
                onClick={() => onSelect(chat.id)}
              >
                {chat.title || "แชท"}
                <small>{chat.created_at}</small>
              </button>
              <button
                type="button"
                className="history-delete"
                aria-label={"เอาแชทออกจากประวัติ " + (chat.title || "")}
                onClick={() => onDelete(chat)}
              >
                เอาออก
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
