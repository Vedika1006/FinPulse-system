import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getHealthScore,
  getMonthlyTrend,
  getCategoryComparison,
  getInsight,
} from "../api/analytics";
import { currentMonthParam, monthLabel } from "../utils/month";
import { formatCurrency as globalFormatCurrency } from "../utils/currency";
import { useTheme } from "../context/ThemeContext";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { CardSkeleton, DashboardSkeleton, InsightSkeleton } from "../components/ui/Skeleton";
import { AlertBanner } from "../components/ui/AlertBanner";
import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import { useNavigate } from "react-router-dom";
import { mapInsightToActions } from "../utils/mapInsightToActions";
import { getUserDisplayName } from "../utils/auth";
import FormattedAIResponse from "../components/FormattedAIResponse";
import { EmptyState } from "../components/ui/EmptyState";
import { AlertTriangle, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { AIFinancialInsights } from "../components/AIFinancialInsights";
import ForecastChart from "../components/ForecastChart";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Diverse 7-colour pie palette ───────────────────────────
// Previous palette was 5 shades of blue — adjacent segments
// were indistinguishable. These 7 hues are visually distinct
// across all segment sizes.
const PIE_COLORS = [
  "#06B6D4", // teal  (brand)
  "#8B5CF6", // violet
  "#F97316", // orange
  "#10B981", // emerald
  "#F43F5E", // rose
  "#EAB308", // amber
  "#3B82F6", // blue
];

const tooltipLight = {
  borderRadius: "12px", border: "1px solid #E5E7EB",
  background: "#FFFFFF", color: "#111827",
};
const tooltipDark = {
  borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)",
  background: "#0D1420", color: "#CBD5E1",
};

export default function Analytics() {
  const { showToast }  = useToast();
  const navigate        = useNavigate();
  const { theme, currency } = useTheme();
  const formatINR = (v) => globalFormatCurrency(v, currency);

  const [profile,        setProfile]        = useState(null);
  const [memory,         setMemory]         = useState(null);
  const [allExpenses,    setAllExpenses]    = useState([]);
  const [month,          setMonth]          = useState(currentMonthParam);
  const [health,         setHealth]         = useState(null);
  const [trend,          setTrend]          = useState([]);
  const [incomeTrend,    setIncomeTrend]    = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [insightPayload, setInsightPayload] = useState(null);
  const [hasBudgets,     setHasBudgets]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [isDark,         setIsDark]         = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [explaining,          setExplaining]          = useState("");
  const [aiExplanation,       setAiExplanation]       = useState("");
  const explanationRef = useState(() => ({ current: null }))[0];
  const [highlightExplanation, setHighlightExplanation] = useState(false);

  // Track theme switching
  useEffect(() => {
    const el  = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const tooltipStyle = isDark ? tooltipDark : tooltipLight;
  const axisTick     = { fill: isDark ? "#64748B" : "#6B7280", fontSize: 11 };
  const gridStroke   = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const legendColor  = isDark ? "#CBD5E1" : "#374151";

  // ── Main data load ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, t, c, ins, inc, bdg] = await Promise.all([
        getHealthScore(month),
        getMonthlyTrend(),
        getCategoryComparison(),
        getInsight(month),
        API.get("/income/"),
        API.get("/budgets/"),
      ]);
      setHealth(h);
      setTrend(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []);
      setInsightPayload(ins);
      setIncomeTrend(Array.isArray(inc?.data) ? inc.data : []);
      setHasBudgets(Array.isArray(bdg?.data) && bdg.data.length > 0);
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.detail || e.message || "Failed to load analytics";
      setError(typeof msg === "string" ? msg : "Failed to load analytics");
      setHealth(null);
      setTrend([]);
      setCategories([]);
      setInsightPayload(null);
      setIncomeTrend([]);
      setHasBudgets(false);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Profile + memory + expenses (non-blocking)
  useEffect(() => {
    (async () => {
      try { const me = await API.get("/auth/me"); setProfile(me.data || null); } catch { setProfile(null); }
      try { const mem = await API.get("/analytics/memory/", { params: { month } }); setMemory(mem.data || null); } catch { setMemory(null); }
      try { const exp = await API.get("/expenses/"); setAllExpenses(Array.isArray(exp.data) ? exp.data : []); } catch { setAllExpenses([]); }
    })();
  }, [month]);

  const displayName = getUserDisplayName(profile);

  // ── Derived chart data ──────────────────────────────────
  const trendData = useMemo(
    () => trend.map((row) => ({ ...row, total: Number(row.total), label: monthLabel(row.month) })),
    [trend]
  );

  const incomeChartData = useMemo(
    () => incomeTrend
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({ label: monthLabel(row.month), total: Number(row.amount) })),
    [incomeTrend]
  );

  const pieData = useMemo(
    () => categories.map((row) => ({ ...row, total: Number(row.total) })),
    [categories]
  );

  const insightsList = useMemo(() => {
    if (!insightPayload) return [];
    const raw = insightPayload.insights;
    return Array.isArray(raw) ? raw : [];
  }, [insightPayload]);


  const recurring = useMemo(() => {
    const rows   = Array.isArray(allExpenses) ? allExpenses : [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
    const buckets = new Map();

    for (const e of rows) {
      const ts = e?.created_at ? new Date(e.created_at) : null;
      if (!ts || Number.isNaN(ts.getTime()) || ts < cutoff) continue;
      const amt      = Math.round(Number(e.amount || 0));
      const desc     = norm(e.description || e.title || "");
      const cat      = norm(e.category || "other");
      const key      = desc ? `d:${desc}|a:${amt}` : `c:${cat}|a:${amt}`;
      const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
      const cur      = buckets.get(key) || { key, desc, cat, amt, count: 0, months: new Set(), last: ts };
      cur.count++;
      cur.months.add(monthKey);
      if (ts > cur.last) cur.last = ts;
      buckets.set(key, cur);
    }

    return Array.from(buckets.values())
      .filter((b) => b.count >= 3 && b.months.size >= 2)
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, 6)
      .map((b) => ({ title: b.desc || b.cat, amount: b.amt, occurrences: b.count, months: b.months.size }));
  }, [allExpenses]);

  const reasons = useMemo(() => {
    const raw = health?.reasons;
    return Array.isArray(raw) ? raw.filter((r) => typeof r === "string" && r.trim()) : [];
  }, [health]);

  // ── Key data flags ──────────────────────────────────────
  // hasAnyData: user has at least some expense or trend data.
  // When false we show the full empty state instead of
  // fabricated health scores and insight cards.
  //
  // hasIncome: user has added income records.
  // When false but hasAnyData is true, we show the amber
  // "score is estimated" banner above AI Insights.
  const hasAnyData = categories.length > 0 || trend.length > 0;
  const hasIncome  = incomeTrend.length > 0;

  // ── AI explain helper ───────────────────────────────────
  const askAIExplain = async (section, context) => {
    if (explaining) return;
    setExplaining(section);
    try {
      const res = await API.post("/ai/chat", {
        message: "Explain this",
        context,
        data: {
          page: "analytics", section, month,
          health: health ? { score: Number(health.score ?? health.health_score), breakdown: health.breakdown, reasons } : null,
          insights: insightsList, trend: trendData, categories: pieData,
        },
      });
      setAiExplanation(res.data?.reply || "No explanation available right now.");
      showToast("AI explanation ready", "success", {
        onClick: () => {
          explanationRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          setHighlightExplanation(true);
          setTimeout(() => setHighlightExplanation(false), 1600);
        },
      });
    } catch {
      showToast("Could not fetch AI explanation", "error");
    } finally {
      setExplaining("");
    }
  };


  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* Month picker + subtitle */}
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-app-muted">
            {displayName ? `${displayName}, here's what changed in your money this month.` : "Your financial trends and health at a glance."}
          </p>
          {memory?.frequent_category && (
            <p className="mt-1 text-xs font-medium text-gray-600 dark:text-app-subtle">
              Pattern: {memory.habit} in <span className="font-semibold">{memory.frequent_category}</span>
            </p>
          )}
        </div>
        {hasAnyData && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-app-subtle">
            <span>Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:focus:border-cyan-500/40"
            />
          </label>
        )}
      </div>

      {error && <AlertBanner message={error} onDismiss={() => setError("")} type="error" />}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><InsightSkeleton /></div>
            <InsightSkeleton />
          </div>
          <DashboardSkeleton />
        </div>
      ) : !hasAnyData ? (

        /* ══════════════════════════════════════════════════
           EMPTY STATE — no expenses recorded yet
           Shows instead of health score + AI insights when
           the user has no data. Prevents misleading "67 Good"
           score appearing on a fresh account.
        ══════════════════════════════════════════════════ */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-24 text-center shadow-sm dark:border-white/[0.08] dark:bg-app-surface">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-500/10">
            <BarChart3 className="h-7 w-7 text-cyan-500" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nothing to analyze yet</h3>
          <p className="mt-2 max-w-xs text-sm text-gray-500 dark:text-app-muted">
            Add your first expense to unlock AI insights, spending trends, anomaly detection, and your financial health score.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => navigate("/expenses")} className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400">
              Add an expense
            </button>
            <button type="button" onClick={() => navigate("/budgets")} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-app-card dark:text-app-subtle dark:hover:bg-white/5">
              Set a budget
            </button>
          </div>
        </div>

      ) : (
        <>
          {/* ══════════════════════════════════════════════
              ESTIMATED SCORE WARNING BANNER
              Shown when the user has expense data but has
              not added income or budgets. The health score
              still shows (backend returns it with defaults)
              but this banner makes clear it is an estimate.
          ══════════════════════════════════════════════ */}
          {(!hasIncome || !hasBudgets) && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Health score is estimated
                </p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400/80">
                  {!hasIncome && !hasBudgets
                    ? "Add monthly income and set category budgets for an accurate score."
                    : !hasIncome
                    ? "Add your monthly income so the score reflects your real savings rate."
                    : "Set category budgets to improve score accuracy."}
                  {" "}
                  <button
                    type="button"
                    onClick={() => navigate(!hasIncome ? "/" : "/budgets")}
                    className="font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    {!hasIncome ? "Add income →" : "Set budgets →"}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              AI INSIGHTS (full width)
          ══════════════════════════════════════════════ */}
          <AIFinancialInsights
            insights={insightsList}
            loading={false}
            health={health}
            hasIncome={hasIncome}
            hasBudgets={hasBudgets}
          />

          {/* Recurring expense detection — hidden when no patterns found */}
          {recurring.length > 0 && (
            <Card>
              <CardHeader title="Recurring expense detection" subtitle="Repeated charges spotted across months" />
              <CardBody className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {recurring.map((r) => (
                    <div
                      key={`${r.title}-${r.amount}-${r.occurrences}`}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-app-card"
                    >
                      <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{r.title}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">
                        ~{formatINR(r.amount)} · {r.occurrences} times · {r.months} months
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate("/expenses")}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-muted dark:hover:bg-white/5"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/budgets")}
                          className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400"
                        >
                          Set budget
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Income over time */}
            <Card>
              <CardHeader title="Income over time" subtitle="Your earning trends" />
              <CardBody className="h-72 pt-0 dark:bg-transparent">
                {incomeChartData.length < 2 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-gray-400 dark:text-app-muted">
                      Add income for 2+ months to see your earning trend
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={incomeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [formatINR(v), "Income"]} contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: "#10B981" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            {/* Monthly trend */}
            <Card>
              <CardHeader
                title="Monthly trend"
                subtitle="Total spend by calendar month"
                action={
                  <button
                    type="button"
                    onClick={() => askAIExplain("trend", "Analytics: monthly spend trend chart.")}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-app-card dark:text-app-subtle dark:hover:bg-white/5"
                  >
                    {explaining === "trend" ? "Explaining…" : "Explain this"}
                  </button>
                }
              />
              <CardBody className="h-72 pt-0 dark:bg-transparent">
                {trendData.length === 0 ? (
                  <EmptyState icon={LineChartIcon} title="No data yet" description="Add some expenses first to see your financial insights." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [formatINR(v), "Spent"]} contentStyle={tooltipStyle} />
                      {/* Line colour: teal brand accent */}
                      <Line type="monotone" dataKey="total" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 4, fill: "#06B6D4" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            {/* Category pie */}
            <Card>
              <CardHeader title="Category breakdown" subtitle="Share of total recorded spend" />
              <CardBody className="h-72 pt-0 dark:bg-transparent">
                {pieData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-500 dark:text-app-muted">No categories to show yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="total"
                        nameKey="category"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        paddingAngle={2}
                        label={({ category, percent }) => {
                          const label = String(category || "").split(/[\s_-]+/g).filter(Boolean)
                            .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                          return `${label} (${(percent * 100).toFixed(0)}%)`;
                        }}
                      >
                        {/* Diverse palette — each slice is a distinct hue */}
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke={isDark ? "rgba(8,12,20,0.95)" : "#FFFFFF"}
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatINR(v)} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ color: legendColor, fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>

          <ForecastChart />

          {/* AI explanation card */}
          {aiExplanation && (
            <Card>
              <div
                ref={(el) => (explanationRef.current = el)}
                className={highlightExplanation ? "rounded-2xl ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#F5F7FB] transition" : ""}
              >
                <CardHeader title="AI Explanation" subtitle="Context-aware guidance for this page" />
              </div>
              <CardBody className="pt-0">
                <FormattedAIResponse text={aiExplanation} />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
