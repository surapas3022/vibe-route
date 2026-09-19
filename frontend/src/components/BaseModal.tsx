import { useEffect, useId, useRef, type ReactNode } from "react";

export type BaseModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
  dismissible?: boolean;
  onClose: () => void;
};

export function BaseModal({
  open,
  title,
  children,
  footer,
  tone = "default",
  dismissible = true,
  onClose,
}: BaseModalProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.hasAttribute("aria-hidden"));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="modal-root" data-component="BaseModal">
      <div
        className="modal-overlay"
        onClick={dismissible ? onClose : undefined}
        onKeyDown={
          dismissible
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") onClose();
              }
            : undefined
        }
        role="presentation"
      />
      <div
        ref={panelRef}
        className={tone === "danger" ? "modal-panel danger" : "modal-panel"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="modal-body">
          {children}
        </div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
