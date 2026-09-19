import { LOADING_COPY, type ChatTurn } from "../types";

type Props = {
  turns: ChatTurn[];
};

function collapseTurns(turns: ChatTurn[]): ChatTurn[] {
  const packed: ChatTurn[] = [];
  for (const turn of turns) {
    const prev = packed[packed.length - 1];
    if (prev && prev.query.trim() === turn.query.trim()) {
      packed[packed.length - 1] = { ...turn, query: prev.query };
    } else {
      packed.push(turn);
    }
  }
  return packed;
}

export function ChatThread({ turns }: Props) {
  const visible = collapseTurns(turns);
  if (!visible.length) return null;
  return (
    <ol className="thread" data-component="ChatThread">
      {visible.flatMap((turn) => {
        const rows = [
          <li key={`${turn.id}-user`} className="bubble-row is-user">
            <p className="turn-query">{turn.query}</p>
          </li>,
        ];
        if (turn.intro) {
          rows.push(
            <li key={`${turn.id}-bot`} className="bubble-row is-bot">
              <p className="turn-intro">{turn.intro}</p>
            </li>,
          );
        } else if (turn.id === "pending") {
          rows.push(
            <li key={`${turn.id}-pending`} className="bubble-row is-bot">
              <p className="turn-intro is-pending">{LOADING_COPY}</p>
            </li>,
          );
        }
        return rows;
      })}
    </ol>
  );
}
