export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gradient-to-r dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.08] ${className}`}
      aria-hidden
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
      <Skeleton className="mb-3 h-5 w-1/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
        <Skeleton className="mb-6 h-6 w-1/4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
            <Skeleton className="mb-6 h-6 w-1/3" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
      <div className="border-b border-gray-200 px-6 py-5 dark:border-white/[0.06]">
        <Skeleton className="h-6 w-1/4" />
      </div>
      <div className="space-y-4 p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
      <Skeleton className="mb-6 h-6 w-1/3" />
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
