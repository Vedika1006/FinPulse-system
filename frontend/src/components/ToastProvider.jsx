import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const showToast = useCallback((message, type = "info", options = {}) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const opts = options && typeof options === "object" ? options : {};
    setItems((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        onClick: typeof opts.onClick === "function" ? opts.onClick : null,
        clickable: Boolean(opts.onClick),
      },
    ]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const styles = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/20 dark:text-emerald-50",
    error: "border-red-200 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-500/20 dark:text-red-50",
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-app-accent/25 dark:bg-app-primary/30 dark:text-app-subtle",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 p-0 sm:p-0">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm shadow-lg transition dark:backdrop-blur-xl ${styles[t.type] || styles.info} ${
              t.clickable ? "cursor-pointer hover:shadow-xl" : ""
            }`}
            onClick={() => {
              if (t.onClick) {
                t.onClick();
                dismiss(t.id);
              }
            }}
            role={t.clickable ? "button" : undefined}
            tabIndex={t.clickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (!t.onClick) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                t.onClick();
                dismiss(t.id);
              }
            }}
          >
            <span className="flex-1">
              {t.message}
              {t.clickable ? (
                <span className="ml-2 text-xs font-semibold underline underline-offset-2 opacity-90">
                  View
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              {"\u2715"}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
