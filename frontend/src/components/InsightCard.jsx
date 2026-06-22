import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { inferInsightVariant } from "../utils/inferInsightVariant";

const VARIANT_STYLES = {
  positive: {
    border: "border-l-emerald-600",
    surface: "border-gray-200 bg-white dark:border-white/10 dark:bg-white/5",
    iconWrap: "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
    text: "text-gray-700 dark:text-gray-200",
    Icon: TrendingUp,
  },
  warning: {
    border: "border-l-amber-500",
    surface: "border-gray-200 bg-white dark:border-white/10 dark:bg-white/5",
    iconWrap: "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100",
    text: "text-gray-700 dark:text-gray-200",
    Icon: AlertTriangle,
  },
  danger: {
    border: "border-l-red-600",
    surface: "border-gray-200 bg-white dark:border-white/10 dark:bg-white/5",
    iconWrap: "border border-red-200 bg-red-50 text-red-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-100",
    text: "text-gray-700 dark:text-gray-200",
    Icon: TrendingDown,
  },
  neutral: {
    border: "border-l-blue-600",
    surface: "border-gray-200 bg-white dark:border-white/10 dark:bg-white/5",
    iconWrap: "border border-blue-200 bg-blue-50 text-blue-700 dark:border-white/15 dark:bg-app-secondary/40 dark:text-app-highlight",
    text: "text-gray-700 dark:text-gray-200",
    Icon: Lightbulb,
  },
};

export function InsightCard({ text, variant: variantProp }) {
  const variant = variantProp || inferInsightVariant(text);
  const cfg = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  const Icon = cfg.Icon;

  return (
    <div
      className={`group flex gap-3 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md dark:ring-1 dark:ring-inset dark:ring-white/5 ${cfg.border} border-l-4 ${cfg.surface} motion-reduce:transform-none`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${cfg.iconWrap}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className={`min-w-0 flex-1 text-left text-sm leading-relaxed ${cfg.text}`}>{text}</p>
    </div>
  );
}
