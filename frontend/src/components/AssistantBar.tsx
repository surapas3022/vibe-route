import type { AssistantStatus } from "../types";

type Props = {
  assistant: AssistantStatus;
};

export function AssistantBar({ assistant }: Props) {
  return (
    <div className="assistant" data-level={assistant.level} data-component="AssistantBar">
      <strong>{assistant.label}</strong>
      <span>{assistant.detail}</span>
    </div>
  );
}
