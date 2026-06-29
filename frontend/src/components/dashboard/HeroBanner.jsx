const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const healthColor = (score) => {
  if (score > 70) return "text-emerald-500";
  if (score > 40) return "text-amber-500";
  return "text-red-500";
};
const healthBarColor = (score) => {
  if (score > 70) return "bg-emerald-500";
  if (score > 40) return "bg-amber-500";
  return "bg-red-500";
};
const healthLabel = (score) => {
  if (score > 70) return "Good";
  if (score > 40) return "Fair";
  return "Needs attention";
};

const HeroBanner = ({ displayName, health, cashflowPrediction, formatCurrency }) => {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-app-ink">
            {getGreeting()}{displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">
            {cashflowPrediction > 0 ? (
              <>On track to spend{" "}
                <span className="font-semibold text-gray-900 dark:text-app-ink">
                  {formatCurrency(cashflowPrediction)}
                </span>{" "}this month.</>
            ) : (
              "Add expenses to see your monthly spending forecast."
            )}
          </p>
        </div>

        {health > 0 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
              Health score
            </p>
            <p className={`mt-0.5 font-bold leading-none tabular-nums text-5xl ${healthColor(health)}`}>
              {Math.round(health)}
            </p>
            <p className={`mt-0.5 text-xs font-semibold ${healthColor(health)}`}>
              {healthLabel(health)}
            </p>
            <div className="ml-auto mt-2 h-1 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ${healthBarColor(health)}`}
                style={{ width: `${Math.min(100, health)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeroBanner;
