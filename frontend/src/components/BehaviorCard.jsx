import { useState, useEffect } from "react";
import { TrendingUp, Zap, Scale } from "lucide-react";
import API from "../api/axios";

const BEHAVIOR_CONFIG = {
  Saver: {
    Icon:  TrendingUp,
    color: "text-emerald-700 dark:text-emerald-300",
    bg:    "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-500/20",
    icon:  "text-emerald-600 dark:text-emerald-400",
  },
  "Impulse Spender": {
    Icon:  Zap,
    color: "text-red-700 dark:text-red-300",
    bg:    "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-500/20",
    icon:  "text-red-600 dark:text-red-400",
  },
  "Lifestyle Creep": {
    Icon:  TrendingUp,
    color: "text-amber-700 dark:text-amber-300",
    bg:    "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/20",
    icon:  "text-amber-600 dark:text-amber-400",
  },
  Balanced: {
    Icon:  Scale,
    color: "text-cyan-700 dark:text-cyan-300",
    bg:    "bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-500/20",
    icon:  "text-cyan-600 dark:text-cyan-400",
  },
};

const BehaviorCard = () => {
  const [behavior, setBehavior] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    API.get("/analytics/behavior")
      .then((res) => setBehavior(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-48 w-full animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-app-surface" />
    );
  }

  if (!behavior) return null;

  const { type, savings_rate, top_category, insight } = behavior;
  const cfg  = BEHAVIOR_CONFIG[type] || BEHAVIOR_CONFIG.Balanced;
  const Icon = cfg.Icon;

  return (
    <div className={`w-full rounded-2xl border p-6 transition-colors ${cfg.bg}`}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
            Financial Fingerprint
          </p>
          {/* Icon replaces emoji */}
          <div className={`flex items-center gap-2 text-xl font-bold ${cfg.color}`}>
            <Icon className={`h-5 w-5 ${cfg.icon}`} aria-hidden />
            {type}
          </div>
        </div>
      </div>

      <p className="mb-5 flex-1 text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-200">
        "{insight}"
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/60 bg-white/60 p-3 text-center dark:border-white/[0.08] dark:bg-black/20">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
            Savings Rate
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {(savings_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/60 p-3 text-center dark:border-white/[0.08] dark:bg-black/20">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
            Top Category
          </p>
          <p className="truncate text-lg font-bold text-gray-900 dark:text-white" title={top_category}>
            {top_category}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BehaviorCard;
