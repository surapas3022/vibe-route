import type { ChatTurn } from "../types";

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
      {visible.map((turn) => (
        <li key={turn.id} className="turn">
          <p className="turn-query">{turn.query}</p>
          {turn.intro ? <p className="turn-intro">{turn.intro}</p> : null}
        </li>
      ))}
    </ol>
  );
}
