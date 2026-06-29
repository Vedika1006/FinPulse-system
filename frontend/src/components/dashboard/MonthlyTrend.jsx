import {
  BarChart, Bar, Rectangle, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

const MonthlyTrend = ({
  trendData,
  income,
  isDark,
  explaining,
  askAIExplain,
  hoveredMonthLabel,
  setHoveredMonthLabel,
  setClickedMonth,
  setSelectedMonth,
  setChartModalOpen,
  setSelectedCats,
  btnPrimary,
  btnSecondary,
  formatCurrency,
  chartTooltipStyle,
  chartAxisTick,
  chartGrid,
  legendStyle,
  navigate,
}) => {
  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const row        = payload[0]?.payload || {};
    const incomeVal  = row.income == null ? null : Number(row.income || 0);
    const expenseVal = Number(row.expense || 0);
    const savingsVal = incomeVal == null ? null : incomeVal - expenseVal;
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-white/[0.08] dark:bg-app-surface dark:text-app-ink" style={{ maxWidth: 240 }}>
        <p className="text-xs font-semibold text-gray-500 dark:text-app-muted">Month: {label}</p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-gray-500 dark:text-app-muted">Income</span>
            <span className="text-sm font-semibold">{incomeVal == null ? "—" : formatCurrency(incomeVal)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-gray-500 dark:text-app-muted">Expenses</span>
            <span className="text-sm font-semibold">{formatCurrency(expenseVal)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-gray-200 pt-1.5 dark:border-white/[0.08]">
            <span className="text-xs text-gray-500 dark:text-app-muted">Savings</span>
            <span className="text-sm font-semibold">{incomeVal == null ? "—" : formatCurrency(savingsVal)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-app-ink">Monthly Trend</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-app-muted">Income vs expenses by month.</p>
        </div>
        <button type="button" onClick={() => askAIExplain("monthly_trend", "Dashboard: monthly trend chart.")} className={btnSecondary}>
          {explaining === "monthly_trend" ? "Explaining…" : "Explain this"}
        </button>
      </div>

      {trendData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-sm font-semibold text-gray-900 dark:text-app-ink">No data yet</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">Add expenses to see your monthly trend.</p>
          <button type="button" onClick={() => navigate("/expenses")} className={`mt-3 ${btnPrimary}`}>
            Add Expense
          </button>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trendData}
              margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
              barCategoryGap={14}
              onMouseMove={(s) => { if (s?.isTooltipActive) setHoveredMonthLabel(String(s.activeLabel || "")); }}
              onMouseLeave={() => setHoveredMonthLabel("")}
            >
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisTick} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${Number(v || 0).toFixed(0)}`} />
              <Tooltip content={<TrendTooltip />} />
              <Legend wrapperStyle={legendStyle} />

              {income?.amount ? (
                <Bar dataKey="income" name="Income" fill="#06B6D4"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={80}
                  isAnimationActive animationDuration={700}
                  onClick={(pt) => {
                    const m = Number(pt?.month);
                    if (!m) return;
                    setClickedMonth(m); setSelectedMonth(m);
                    setChartModalOpen(true); setSelectedCats(new Set());
                  }}
                  shape={(props) => <Rectangle {...props} fillOpacity={hoveredMonthLabel && props?.payload?.label === hoveredMonthLabel ? 1 : 0.85} />}
                >
                  <LabelList dataKey="income" position="top"
                    formatter={(v) => (v ? `₹${Number(v).toFixed(0)}` : "")}
                    style={{ fontSize: 10, fill: isDark ? "#94A3B8" : "#6B7280", fontWeight: 500 }}
                  />
                </Bar>
              ) : null}

              <Bar dataKey="expense" name="Expense" fill="#F97316"
                radius={[6, 6, 0, 0]}
                maxBarSize={80}
                isAnimationActive animationDuration={700}
                onClick={(pt) => {
                  const m = Number(pt?.month);
                  if (!m) return;
                  setClickedMonth(m); setSelectedMonth(m);
                  setChartModalOpen(true); setSelectedCats(new Set());
                }}
                shape={(props) => <Rectangle {...props} fillOpacity={hoveredMonthLabel && props?.payload?.label === hoveredMonthLabel ? 1 : 0.85} />}
              >
                <LabelList dataKey="expense" position="top"
                  formatter={(v) => (v ? `₹${Number(v).toFixed(0)}` : "")}
                  style={{ fontSize: 10, fill: isDark ? "#94A3B8" : "#6B7280", fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default MonthlyTrend;
