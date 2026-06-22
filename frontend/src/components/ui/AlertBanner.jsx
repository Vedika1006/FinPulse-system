export function AlertBanner({ type = "error", message, onDismiss }) {
  if (!message) return null;
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100",
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-app-accent/30 dark:bg-app-primary/30 dark:text-app-subtle",
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm ${styles[type]}`}
      role="alert"
    >
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-0.5 text-current opacity-70 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
