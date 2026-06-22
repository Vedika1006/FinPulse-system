export function Spinner({ className = "h-8 w-8", label = "Loading" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
      <div
        className={`animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400 ${className}`}
        aria-hidden
      />
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}
