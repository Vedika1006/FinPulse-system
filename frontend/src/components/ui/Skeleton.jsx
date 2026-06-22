export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gradient-to-r dark:from-white/10 dark:via-white/5 dark:to-white/10 ${className}`}
      aria-hidden
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-app-card/70 dark:shadow-inner dark:backdrop-blur-xl">
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
        <Skeleton className="mb-6 h-6 w-1/4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
          <Skeleton className="mb-6 h-6 w-1/3" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
          <Skeleton className="mb-6 h-6 w-1/3" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-0 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
      <div className="border-b border-gray-200 px-6 py-5 dark:border-white/10">
        <Skeleton className="h-6 w-1/4" />
      </div>
      <div className="p-6 space-y-4">
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
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
       <Skeleton className="mb-6 h-6 w-1/3" />
       <div className="space-y-4">
         <Skeleton className="h-24 w-full" />
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
         </div>
       </div>
    </div>
  );
}
