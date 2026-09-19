import { BaseModal } from "./BaseModal";

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "danger",
  loading = false,
  error = "",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <BaseModal
      open={open}
      title={title}
      tone={tone}
      dismissible={!loading}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="modal-btn ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "modal-btn danger" : "modal-btn primary"}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "กำลังทำ…" : confirmLabel}
          </button>
        </>
      }
    >
      <p>{description}</p>
      {error ? (
        <p className="modal-error" role="alert">
          {error}
        </p>
      ) : null}
    </BaseModal>
  );
}
