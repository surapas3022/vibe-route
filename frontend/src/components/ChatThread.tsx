import type { ChatTurn } from "../types";

type Props = {
  turns: ChatTurn[];
};

export function ChatThread({ turns }: Props) {
  if (!turns.length) return null;
  return (
    <ol className="thread" data-component="ChatThread">
      {turns.map((turn) => (
        <li key={turn.id} className="turn">
          <p className="turn-query">{turn.query}</p>
          {turn.intro ? <p className="turn-intro">{turn.intro}</p> : null}
        </li>
      ))}
    </ol>
  );
}
