import { AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";

const WeeklyReport = ({
  weekly,
  weeklyBars,
  weeklyAction,
  weeklyActionLoading,
  cashflowPrediction,
  smartAlerts,
  formatCurrency,
  isDark,
  chartTooltipStyle,
  chartAxisTick,
  chartGrid,
  className,
}) => {
  return (
    <div className={`h-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card${className ? ` ${className}` : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-app-ink">Weekly Financial Report</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-app-muted">Last 7 days at a glance.</p>
        </div>
        {smartAlerts.length > 0 && (
          <div className="space-y-1 text-right">
            {smartAlerts.map((a, i) => (
              <div key={i} className="flex items-center justify-end gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden />
                {a}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPI tiles — 4-col grid; suggested action spans full width */}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Change vs last week", value: weekly.prevTotal > 0 ? `${weekly.pct >= 0 ? "+" : ""}${weekly.pct.toFixed(0)}%` : "—", textClass: "font-mono text-lg tabular-nums" },
          { label: "Weekly expense",      value: weekly.thisTotal > 0 ? formatCurrency(weekly.thisTotal) : "—",                           textClass: "font-mono text-xl font-bold tabular-nums" },
          { label: "Top category",        value: weekly.topCategory ? String(weekly.topCategory) : "—",                                  textClass: "text-lg font-bold" },
          { label: "Risk level",          value: weekly.risk,                                                                             textClass: "text-lg tabular-nums" },
          { label: "Suggested action",    value: weeklyActionLoading ? "Generating…" : weeklyAction || "—",                              textClass: "text-sm leading-snug", colSpan: "col-span-2 md:col-span-4" },
        ].map(({ label, value, textClass, colSpan = "" }) => (
          <div key={label} className={`overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.04] dark:bg-app-surface ${colSpan}`}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">{label}</p>
            <p className={`mt-1.5 font-semibold text-gray-900 dark:text-app-ink ${textClass}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Weekly bar chart */}
      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.04] dark:bg-app-surface">
        <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-app-subtle">This week (Mon–Sun)</p>
        {weeklyBars.every((d) => (d.spent || 0) === 0) ? (
          <p className="text-sm text-gray-500 dark:text-app-muted">No spending recorded this week yet.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyBars} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap={12}>
                <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={chartAxisTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartAxisTick} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${Number(v || 0).toFixed(0)}`} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [formatCurrency(v), "Spent"]} labelFormatter={(l) => `Day: ${l}`} />
                <Bar dataKey="spent" name="Spent" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive animationDuration={700}>
                  {weeklyBars.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.isHigh && !entry.isFuture ? "#EF4444" : "#06B6D4"}
                      fillOpacity={entry.isFuture ? 0.25 : 1}
                    />
                  ))}
                  <LabelList dataKey="spent" position="top"
                    formatter={(v) => (v ? `₹${Number(v).toFixed(0)}` : "")}
                    style={{ fontSize: 10, fill: isDark ? "#94A3B8" : "#6B7280", fontWeight: 500 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-500 dark:text-app-muted">
        At this rate, you will spend{" "}
        <span className="font-semibold text-gray-900 dark:text-app-ink">{formatCurrency(cashflowPrediction)}</span>{" "}
        this month.
      </p>
    </div>
  );
};

export default WeeklyReport;
