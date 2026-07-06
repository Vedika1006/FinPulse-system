import { useMemo } from "react";
import { motion } from "framer-motion";

const CELL = 13;
const GAP = 2;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

const TONE_CLASS = {
  empty: "bg-gray-100 dark:bg-white/5",
  low: "bg-emerald-200 dark:bg-emerald-900/40",
  normal: "bg-emerald-400 dark:bg-emerald-700/60",
  above: "bg-amber-300 dark:bg-amber-600/60",
  high: "bg-red-400 dark:bg-red-600/60",
};

const LEGEND = [
  { tone: "empty", label: "No spend" },
  { tone: "low", label: "Low" },
  { tone: "normal", label: "Normal" },
  { tone: "above", label: "Above avg" },
  { tone: "high", label: "High" },
];

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// JS getDay(): 0=Sun..6=Sat. We want week rows as 0=Mon..6=Sun.
function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

function toneFor(amount, dailyAverage) {
  if (!amount) return "empty";
  if (dailyAverage <= 0) return "high";
  const ratio = amount / dailyAverage;
  if (ratio < 0.5) return "low";
  if (ratio < 1) return "normal";
  if (ratio < 2) return "above";
  return "high";
}

function buildHeatmapData(expenses) {
  const dailyTotals = {};
  for (const exp of expenses || []) {
    const raw = exp?.date || exp?.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = toKey(d);
    dailyTotals[key] = (dailyTotals[key] || 0) + Number(exp.amount || 0);
  }

  const daysWithData = Object.keys(dailyTotals).length;
  const spendingAmounts = Object.values(dailyTotals).filter((v) => v > 0);
  const daysWithSpending = spendingAmounts.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rawStart = new Date(today);
  rawStart.setDate(rawStart.getDate() - 364);
  const start = new Date(rawStart);
  start.setDate(start.getDate() - mondayIndex(start.getDay()));

  const allDates = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    allDates.push(new Date(d));
  }

  // Average only over days that actually had spending — including the many
  // zero-spend days would drag the baseline so low that almost any real
  // expense reads as "high" (red), collapsing the intended color gradation.
  const dailyAverage =
    daysWithSpending > 0 ? spendingAmounts.reduce((s, v) => s + v, 0) / daysWithSpending : 0;

  const numWeeks = Math.ceil(allDates.length / 7);
  const columns = [];
  const weekMonthLabels = [];

  for (let w = 0; w < numWeeks; w++) {
    const weekDates = allDates.slice(w * 7, w * 7 + 7);

    let label = "";
    for (const d of weekDates) {
      if (d.getDate() === 1) {
        label = MONTH_ABBR[d.getMonth()];
        break;
      }
    }
    weekMonthLabels.push(label);

    const column = [];
    for (let i = 0; i < 7; i++) {
      const d = weekDates[i];
      if (!d) {
        column.push(null);
        continue;
      }
      const key = toKey(d);
      const amount = dailyTotals[key] || 0;
      column.push({ date: d, key, amount, tone: toneFor(amount, dailyAverage) });
    }
    columns.push(column);
  }

  return { daysWithData, daysWithSpending, columns, weekMonthLabels, numWeeks };
}

function formatCellDate(d) {
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

function HeatCell({ cell }) {
  if (!cell) {
    return <div style={{ width: CELL, height: CELL }} />;
  }
  return (
    <div
      className={`group relative rounded-[2px] ${TONE_CLASS[cell.tone]}`}
      style={{ width: CELL, height: CELL }}
    >
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-900 shadow-lg group-hover:block dark:border-white/10 dark:bg-app-card dark:text-white">
        {formatCellDate(cell.date)} — ₹{Math.round(cell.amount).toLocaleString("en-IN")}
      </div>
    </div>
  );
}

export default function SpendingHeatmap({ expenses }) {
  const { daysWithData, daysWithSpending, columns, weekMonthLabels, numWeeks } = useMemo(
    () => buildHeatmapData(expenses),
    [expenses]
  );

  if (daysWithData < 14 || daysWithSpending < 3) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Spending Heatmap</p>
        <p className="mb-4 text-xs text-gray-400 dark:text-app-muted">
          Daily spending intensity over the last 12 months.
        </p>

        <div className="flex gap-2">
          {/* Row labels (Mon/Wed/Fri) — stay fixed while the grid scrolls */}
          <div className="flex flex-shrink-0 flex-col">
            <div style={{ height: 14 }} />
            <div
              className="grid"
              style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gap: `${GAP}px` }}
            >
              {ROW_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex items-center text-[10px] leading-none text-gray-400 dark:text-app-muted"
                  style={{ height: CELL }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Month labels + day grid, scroll together on mobile */}
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${numWeeks}, ${CELL}px)`,
                gap: `${GAP}px`,
                marginBottom: GAP,
                height: 14,
              }}
            >
              {weekMonthLabels.map((label, i) => (
                <div
                  key={i}
                  className="whitespace-nowrap text-[10px] leading-none text-gray-400 dark:text-app-muted"
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${numWeeks}, ${CELL}px)`,
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoFlow: "column",
                gap: `${GAP}px`,
              }}
            >
              {columns.map((column, w) =>
                column.map((cell, i) => <HeatCell key={`${w}-${i}`} cell={cell} />)
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-app-muted">
          {LEGEND.map(({ tone, label }) => (
            <span key={tone} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-[2px] ${TONE_CLASS[tone]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
