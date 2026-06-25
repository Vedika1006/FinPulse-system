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
import { LineChart as LineChartIcon } from "lucide-react";
import { AIFinancialInsights } from "../components/AIFinancialInsights";
import ForecastChart from "../components/ForecastChart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#1d4ed8", "#059669", "#0891b2"];

const chartTooltipLight = {
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  color: "#111827",
};

const chartTooltipDark = {
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(30,34,71,0.95)",
  color: "#C9D1E3",
};

export default function Analytics() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { theme, currency } = useTheme();
  const formatINR = (v) => globalFormatCurrency(v, currency);
  const [profile, setProfile] = useState(null);
  const [memory, setMemory] = useState(null);
  const [allExpenses, setAllExpenses] = useState([]);
  const [month, setMonth] = useState(currentMonthParam);
  const [health, setHealth] = useState(null);
  const [trend, setTrend] = useState([]);
  const [incomeTrend, setIncomeTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [insightPayload, setInsightPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [explaining, setExplaining] = useState("");
  const [aiExplanation, setAiExplanation] = useState("");
  const explanationRef = useState(() => ({ current: null }))[0];
  const [highlightExplanation, setHighlightExplanation] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const chartTooltipStyle = isDark ? chartTooltipDark : chartTooltipLight;
  const axisTick = { fill: isDark ? "#9AA3B2" : "#374151", fontSize: 12 };
  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : "#E5E7EB";
  const legendColor = isDark ? "#C9D1E3" : "#374151";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, t, c, ins, inc] = await Promise.all([
        getHealthScore(month),
        getMonthlyTrend(),
        getCategoryComparison(),
        getInsight(month),
        API.get("/income/"),
      ]);
      setHealth(h);
      setTrend(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []);
      setInsightPayload(ins);
      setIncomeTrend(Array.isArray(inc?.data) ? inc.data : []);
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.response?.data?.detail ||
        e.message ||
        "Failed to load analytics";
      setError(typeof msg === "string" ? msg : "Failed to load analytics");
      setHealth(null);
      setTrend([]);
      setCategories([]);
      setInsightPayload(null);
      setIncomeTrend([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const me = await API.get("/auth/me");
        setProfile(me.data || null);
      } catch {
        setProfile(null);
      }
      try {
        const mem = await API.get("/analytics/memory/", { params: { month } });
        setMemory(mem.data || null);
      } catch {
        setMemory(null);
      }
      try {
        const exp = await API.get("/expenses/");
        setAllExpenses(Array.isArray(exp.data) ? exp.data : []);
      } catch {
        setAllExpenses([]);
      }
    })();
  }, [month]);

  const displayName = getUserDisplayName(profile);

  const trendData = useMemo(
    () =>
      trend.map((row) => ({
        ...row,
        total: Number(row.total),
        label: monthLabel(row.month),
      })),
    [trend]
  );

  const incomeChartData = useMemo(() => {
    return incomeTrend
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        label: monthLabel(row.month),
        total: Number(row.amount),
      }));
  }, [incomeTrend]);

  const pieData = useMemo(
    () =>
      categories.map((row) => ({
        ...row,
        total: Number(row.total),
      })),
    [categories]
  );

  const insightsList = useMemo(() => {
    if (!insightPayload) return [];
    const raw = insightPayload.insights;
    return Array.isArray(raw) ? raw : [];
  }, [insightPayload]);

  const nextActions = useMemo(() => {
    const items = [];
    for (const line of insightsList) {
      const acts = mapInsightToActions(line, { month });
      for (const a of acts) items.push({ ...a, source: line });
    }
    const seen = new Set();
    const uniq = items.filter((it) => {
      const k = `${it.label}|${it.to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return uniq.slice(0, 4);
  }, [insightsList, month]);

  const recurring = useMemo(() => {
    const rows = Array.isArray(allExpenses) ? allExpenses : [];
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 90);

    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "")
        .trim();

    const buckets = new Map();
    for (const e of rows) {
      const ts = e?.created_at ? new Date(e.created_at) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (ts < cutoff) continue;

      const amt = Math.round(Number(e.amount || 0));
      const desc = norm(e.description || e.title || "");
      const cat = norm(e.category || "other");
      const key = desc ? `d:${desc}|a:${amt}` : `c:${cat}|a:${amt}`;
      const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;

      const cur = buckets.get(key) || { key, desc, cat, amt, count: 0, months: new Set(), last: ts };
      cur.count += 1;
      cur.months.add(monthKey);
      if (ts > cur.last) cur.last = ts;
      buckets.set(key, cur);
    }

    return Array.from(buckets.values())
      .filter((b) => b.count >= 3 && b.months.size >= 2)
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, 6)
      .map((b) => ({
        title: b.desc ? b.desc : b.cat,
        amount: b.amt,
        occurrences: b.count,
        months: b.months.size,
      }));
  }, [allExpenses]);

  const reasons = useMemo(() => {
    const raw = health?.reasons;
    return Array.isArray(raw) ? raw.filter((r) => typeof r === "string" && r.trim().length > 0) : [];
  }, [health]);

  const askAIExplain = async (section, context) => {
    if (explaining) return;
    setExplaining(section);
    try {
      const res = await API.post("/ai/chat", { message: "Explain this", context, data: {
        page: "analytics",
        section,
        month,
        health: health
          ? { score: Number(health.score ?? health.health_score), breakdown: health.breakdown, reasons: reasons }
          : null,
        insights: insightsList,
        trend: trendData,
        categories: pieData,
      }});
      const reply = res.data?.reply || "No explanation available right now.";
      setAiExplanation(reply);
      showToast("AI explanation ready", "success", {
        onClick: () => {
          explanationRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          setHighlightExplanation(true);
          window.setTimeout(() => setHighlightExplanation(false), 1600);
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
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-app-muted">
            {displayName}, here’s what changed in your money this month.
          </p>
          {memory?.frequent_category ? (
            <p className="mt-2 text-xs font-medium text-gray-700 dark:text-white/80">
              Based on your past behavior: {memory.habit} in <span className="font-semibold">{memory.frequent_category}</span>.
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-app-subtle">
          <span>Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-app-surface/90 dark:text-white dark:focus:border-app-accent/50 dark:focus:ring-app-accent/25"
          />
        </label>
      </div>

      {error ? (
        <AlertBanner message={error} onDismiss={() => setError("")} type="error" />
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <InsightSkeleton />
            </div>
            <div>
              <InsightSkeleton />
            </div>
          </div>
          <DashboardSkeleton />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AIFinancialInsights insights={insightsList} loading={false} health={health} />
            </div>
            <Card hover>
              <CardHeader title="What should you do next?" subtitle="Quick actions that reduce risk" />
              <CardBody className="space-y-3 pt-0">
                {nextActions.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-app-muted">
                    Add expenses and budgets to unlock next best actions.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {nextActions.map((a) => (
                      <div
                        key={`${a.label}-${a.to}`}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.label}</p>
                        <p className="mt-1 text-xs font-medium text-gray-700 dark:text-white/80">
                          This action will help reduce your risk
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => navigate(a.to)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                          >
                            Do it now
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/expenses")}
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                          >
                            View transactions
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recurring expense detection" subtitle="Repeated charges spotted across months" />
            <CardBody className="pt-0">
              {recurring.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-app-muted">
                  No recurring patterns detected yet (need repeated transactions across months).
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {recurring.map((r) => (
                    <div
                      key={`${r.title}-${r.amount}-${r.occurrences}`}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.title}</p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-white/80">
                        ~{formatINR(r.amount)} • {r.occurrences} times • {r.months} months
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => navigate("/expenses")}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                        >
                          Review transactions
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/budgets")}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          Set a budget
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Income over time"
                subtitle="Your earning trends"
              />
              <CardBody className="h-80 bg-white pt-0 dark:bg-transparent">
                {incomeChartData.length === 0 ? (
                  <EmptyState
                    icon={LineChartIcon}
                    title="No data yet"
                    description="Record your income to see your earnings trajectory."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={incomeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={axisTick}
                        tickFormatter={(v) => `\u20B9${v}`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [formatINR(value), "Income"]}
                        contentStyle={chartTooltipStyle}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#059669" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Monthly trend"
                subtitle="Total spend by calendar month"
                action={
                  <button
                    type="button"
                    onClick={() => askAIExplain("trend", "Analytics page: monthly spend trend chart.")}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1E2247] dark:text-[#C9D1E3]"
                  >
                    {explaining === "trend" ? "Explaining..." : "Explain this"}
                  </button>
                }
              />
              <CardBody className="h-80 bg-white pt-0 dark:bg-transparent">
                {trendData.length === 0 ? (
                  <EmptyState
                    icon={LineChartIcon}
                    title="No data yet"
                    description="Add some expenses first to see your financial insights."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={axisTick}
                        tickFormatter={(v) => `\u20B9${v}`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [formatINR(value), "Spent"]}
                        contentStyle={chartTooltipStyle}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#2563eb" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Category breakdown" subtitle="Share of total recorded spend" />
              <CardBody className="h-80 bg-white pt-0 dark:bg-transparent">
                {pieData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-600 dark:text-app-muted">
                    No categories to show yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        paddingAngle={2}
                        label={({ category, percent }) => {
                          const label = String(category || "")
                            .split(/[\s_-]+/g)
                            .filter(Boolean)
                            .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
                            .join(" ");
                          return `${label} (${(percent * 100).toFixed(0)}%)`;
                        }}
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke={isDark ? "rgba(15,18,38,0.95)" : "#FFFFFF"}
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatINR(value)} contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ color: legendColor }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>

          <ForecastChart />

          {aiExplanation ? (
            <Card>
              <div
                ref={(el) => (explanationRef.current = el)}
                className={highlightExplanation ? "rounded-2xl ring-2 ring-blue-600 ring-offset-2 ring-offset-[#F5F7FB] transition" : ""}
              >
                <CardHeader title="AI Explanation" subtitle="Context-aware guidance for this page" />
              </div>
              <CardBody className="pt-0">
                <FormattedAIResponse text={aiExplanation} />
              </CardBody>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
