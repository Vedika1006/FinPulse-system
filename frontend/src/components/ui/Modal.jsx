import { useEffect } from "react";

export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/40 dark:bg-black/60"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md scale-100 rounded-2xl border border-gray-200 bg-white p-0 shadow-lg dark:border-white/10 dark:bg-app-card/95 dark:shadow-glow">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-app-muted dark:hover:bg-white/10 dark:hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 text-left text-gray-700 dark:text-app-subtle">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
