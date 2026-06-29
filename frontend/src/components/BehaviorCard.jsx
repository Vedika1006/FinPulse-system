import { useState, useEffect } from "react";
import { TrendingUp, Zap, Scale } from "lucide-react";
import API from "../api/axios";

const BEHAVIOR_CONFIG = {
  Saver: {
    Icon:   TrendingUp,
    badge:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    accent: "border-l-emerald-500",
    stat:   "text-emerald-600 dark:text-emerald-400",
  },
  "Impulse Spender": {
    Icon:   Zap,
    badge:  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    accent: "border-l-orange-500",
    stat:   "text-orange-600 dark:text-orange-400",
  },
  "Lifestyle Creep": {
    Icon:   TrendingUp,
    badge:  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    accent: "border-l-amber-500",
    stat:   "text-amber-600 dark:text-amber-400",
  },
  Balanced: {
    Icon:   Scale,
    badge:  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
    accent: "border-l-cyan-500",
    stat:   "text-cyan-600 dark:text-cyan-400",
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
      <div className="w-full animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.05] dark:bg-app-card">
        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
        <div className="mt-3 h-8 w-36 rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="mt-3 h-12 w-full rounded bg-gray-200 dark:bg-white/10" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="h-16 rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-16 rounded-xl bg-gray-100 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (!behavior) return null;

  const { type, savings_rate, top_category, insight } = behavior;
  const cfg  = BEHAVIOR_CONFIG[type] || BEHAVIOR_CONFIG.Balanced;
  const Icon = cfg.Icon;

  return (
    <div className={`w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card border-l-4 ${cfg.accent}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
        Financial Fingerprint
      </p>

      {/* Prominent behavior type badge */}
      <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${cfg.badge}`}>
        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
        {type}
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-gray-600 dark:text-app-subtle">
        "{insight}"
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center dark:border-white/[0.04] dark:bg-app-surface">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
            Savings Rate
          </p>
          <p className={`font-mono text-xl font-bold ${cfg.stat}`}>
            {(savings_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center dark:border-white/[0.04] dark:bg-app-surface">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
            Top Category
          </p>
          <p className="truncate font-mono text-xl font-bold text-gray-900 dark:text-app-ink" title={top_category}>
            {top_category}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BehaviorCard;
