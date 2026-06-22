export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 dark:border-white/15 dark:bg-white/[0.04]">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
          <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-600 dark:text-app-muted max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:shadow-glow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
