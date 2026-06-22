export function ConfirmDialog({ isOpen, title = "Confirm", message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button 
        type="button" 
        className="absolute inset-0 bg-gray-900/40 dark:bg-black/60" 
        aria-label="Close confirm overlay" 
        onClick={onCancel} 
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-0 shadow-lg dark:border-white/10 dark:bg-app-card">
        <div className="border-b border-gray-200 px-6 py-4 text-left dark:border-white/10">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="px-6 py-5 text-left text-sm text-gray-600 dark:text-app-muted">
          {message}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-app-subtle dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
