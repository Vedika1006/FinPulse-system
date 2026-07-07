import { Mic, Check, Sparkles, AlertTriangle } from "lucide-react";

// Styled HTML/CSS mockups for each feature row — no images, all built from
// the same visual language (colors, spacing) as the real app components.

const CARD = "rounded-2xl border border-gray-100 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-app-card";
const INNER = "rounded-xl border border-gray-100 bg-gray-50 dark:border-white/5 dark:bg-black/20";
const EYEBROW = "mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-app-muted";

export function ExpenseEntryVisual() {
  return (
    <div className={CARD}>
      <p className={EYEBROW}>Add an expense</p>
      <div className={`flex items-center gap-2.5 px-3.5 py-3 ${INNER}`}>
        <Mic className="h-4 w-4 flex-shrink-0 text-app-accent" />
        <span className="text-sm text-gray-700 dark:text-gray-200">₹450 Swiggy dinner</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-500/10">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-3 w-3 text-white" />
          </span>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Categorized as Food</span>
        </div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Swiggy</span>
      </div>
    </div>
  );
}

export function AIChatVisual() {
  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500 dark:text-app-secondary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-app-muted">FinPulse AI</p>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-app-accent px-3.5 py-2 text-sm text-white">
          Am I saving enough?
        </div>
      </div>
      <div className="mt-2.5 flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-sm leading-relaxed text-gray-700 dark:bg-white/5 dark:text-gray-200">
          Your income is ₹85,000/month but you're saving only <strong>1.4%</strong> (₹1,190). Aim for at
          least 20% — consider an ELSS SIP under Section 80C to save tax while you build the habit.
        </div>
      </div>
    </div>
  );
}

const HEATMAP_TONE = {
  empty: "bg-gray-100 dark:bg-white/5",
  low: "bg-emerald-200 dark:bg-emerald-900/40",
  normal: "bg-emerald-400 dark:bg-emerald-700/60",
  above: "bg-amber-300 dark:bg-amber-600/60",
  high: "bg-red-500",
};

export function AnomalyVisual() {
  const cells = Array.from({ length: 35 }, (_, i) => {
    if (i === 24) return "high";
    if (i % 9 === 0) return "above";
    if (i % 4 === 0) return "normal";
    if (i % 3 === 0) return "low";
    return "empty";
  });
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>₹12,000</strong> on Shopping — <strong>3.8x</strong> your usual ₹3,185
        </p>
      </div>
      <p className={`${EYEBROW} mt-4`}>Spending heatmap</p>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((tone, i) => (
          <div key={i} className={`h-3.5 w-3.5 rounded-[2px] ${HEATMAP_TONE[tone]}`} />
        ))}
      </div>
    </div>
  );
}

export function SubscriptionsVisual() {
  const items = [
    { name: "Netflix", amount: 649, due: "3 Aug" },
    { name: "Spotify", amount: 179, due: "9 Aug" },
    { name: "Rent", amount: 18000, due: "1 Aug" },
  ];
  return (
    <div className={CARD}>
      <p className={EYEBROW}>Tracked subscriptions</p>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.name}
            className="flex items-center justify-between rounded-xl border border-gray-100 border-l-4 border-l-blue-300 bg-gray-50 px-3 py-2 dark:border-white/5 dark:border-l-blue-300 dark:bg-black/20"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{it.name}</p>
              <p className="text-xs text-gray-500 dark:text-app-muted">Next due {it.due}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                ₹{it.amount.toLocaleString("en-IN")}
              </p>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                Tracked
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EMITaxVisual() {
  const emiProgress = 34;
  const taxProgress = Math.round((80000 / 150000) * 100);
  return (
    <div className={`${CARD} grid grid-cols-2 gap-3`}>
      <div className={`p-3 ${INNER}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-app-muted">Home Loan EMI</p>
        <p className="mt-1 font-mono text-lg font-bold text-gray-900 dark:text-white">
          ₹25,093<span className="text-xs font-normal text-gray-400 dark:text-app-muted">/mo</span>
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-app-accent" style={{ width: `${emiProgress}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-app-muted">{emiProgress}% paid off</p>
      </div>
      <div className={`p-3 ${INNER}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-app-muted">80C Savings</p>
        <p className="mt-1 font-mono text-lg font-bold text-gray-900 dark:text-white">
          ₹80K<span className="text-xs font-normal text-gray-400 dark:text-app-muted">/₹1.5L</span>
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${taxProgress}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-app-muted">{taxProgress}% of limit used</p>
      </div>
    </div>
  );
}
