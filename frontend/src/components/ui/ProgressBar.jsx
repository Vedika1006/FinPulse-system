import { clampPct } from "../../utils/currency";

const toneClass = {
  safe: "bg-emerald-600 dark:bg-emerald-400",
  warn: "bg-amber-500 dark:bg-amber-400",
  danger: "bg-red-600 dark:bg-red-500",
};

export function ProgressBar({ pct, tone = "safe", className = "" }) {
  const width = clampPct(pct);
  return (
    <div
      className={`h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:border dark:border-white/10 dark:bg-app-surface/80 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${toneClass[tone]}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function budgetUsageTone(pctUsed) {
  const p = Number(pctUsed);
  if (Number.isNaN(p)) return "safe";
  if (p > 100) return "danger";
  if (p >= 80) return "warn";
  return "safe";
}
