import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getHealthScore,
  getMonthlyTrend,
  getCategoryComparison,
  getInsight,
} from "../api/analytics";
import { currentMonthParam, monthLabel } from "../utils/month";
import { formatCurrency as globalFormatCurrency } from "../utils/currency";
import { useTheme } from "../context/ThemeContext";
import { AlertBanner } from "../components/ui/AlertBanner";
import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import { useNavigate } from "react-router-dom";
import { getUserDisplayName } from "../utils/auth";
import ForecastChart from "../components/ForecastChart";
import SpendingHeatmap from "../components/SpendingHeatmap";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  AlertTriangle, BarChart3, TrendingUp, Zap, Repeat,
  ChevronDown, ChevronUp, Sparkles, Check,
} from "lucide-react";

// ── Palette ────────────────────────────────────────────────
const PIE_COLORS = [
  "#06B6D4", "#8B5CF6", "#F97316",
  "#10B981", "#F43F5E", "#EAB308", "#3B82F6",
];

const tooltipLight = {
  borderRadius: "12px", border: "1px solid #E5E7EB",
  background: "#FFFFFF", color: "#111827",
};
const tooltipDark = {
  borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)",
  background: "#0D1420", color: "#CBD5E1",
};

// ── Animation helpers ──────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

const stagger     = { animate: { transition: { staggerChildren: 0.08 } } };
const staggerItem = { initial: { opacity: 0, x: -12 }, animate: { opacity: 1, x: 0 } };

// ── Shared style tokens ────────────────────────────────────
const CARD = "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card";
const BTN_PRIMARY   = "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 active:scale-[0.99]";
const BTN_SECONDARY = "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-subtle dark:hover:bg-white/5";

// ── Capitalize helper ──────────────────────────────────────
const titleCase = (s) =>
  String(s || "").split(/[\s_-]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

export default function Analytics() {
  const { showToast } = useToast();
  const navigate       = useNavigate();
  const { currency }   = useTheme();
  const formatINR = (v) => globalFormatCurrency(v, currency);

  // ── All existing state (unchanged) ──────────────────────
  const [profile,             setProfile]             = useState(null);
  const [memory,              setMemory]              = useState(null);
  const [allExpenses,         setAllExpenses]         = useState([]);
  const [month,               setMonth]               = useState(currentMonthParam);
  const [health,              setHealth]              = useState(null);
  const [trend,               setTrend]               = useState([]);
  const [incomeTrend,         setIncomeTrend]         = useState([]);
  const [categories,          setCategories]          = useState([]);
  const [insightPayload,      setInsightPayload]      = useState(null);
  const [hasBudgets,          setHasBudgets]          = useState(false);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState("");
  const [isDark,              setIsDark]              = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [explaining,          setExplaining]          = useState("");
  const [aiExplanation,       setAiExplanation]       = useState("");
  const explanationRef = useState(() => ({ current: null }))[0];
  const [highlightExplanation, setHighlightExplanation] = useState(false);

  // ── New UI-only state ────────────────────────────────────
  const [budgetData,       setBudgetData]       = useState([]);
  const [forecastSummary,  setForecastSummary]  = useState(null);
  const [showFullForecast, setShowFullForecast] = useState(false);
  const [expandAccordion,  setExpandAccordion]  = useState(false);
  const [animatedScore,    setAnimatedScore]    = useState(0);

  // ── Theme observer (unchanged) ───────────────────────────
  useEffect(() => {
    const el  = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const tooltipStyle = isDark ? tooltipDark : tooltipLight;
  const axisTick     = { fill: isDark ? "#64748B" : "#6B7280", fontSize: 11 };
  const gridStroke   = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";

  // ── Main data load (unchanged + stores budgetData) ───────
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
      setBudgetData(Array.isArray(bdg?.data) ? bdg.data : []);
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.detail || e.message || "Failed to load analytics";
      setError(typeof msg === "string" ? msg : "Failed to load analytics");
      setHealth(null);
      setTrend([]);
      setCategories([]);
      setInsightPayload(null);
      setIncomeTrend([]);
      setHasBudgets(false);
      setBudgetData([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // ── Profile + memory + expenses (unchanged) ──────────────
  useEffect(() => {
    (async () => {
      try { const me = await API.get("/auth/me"); setProfile(me.data || null); } catch { setProfile(null); }
      try { const mem = await API.get("/analytics/memory/", { params: { month } }); setMemory(mem.data || null); } catch { setMemory(null); }
      try { const exp = await API.get("/expenses/"); setAllExpenses(Array.isArray(exp.data) ? exp.data : []); } catch { setAllExpenses([]); }
    })();
  }, [month]);

  // ── Forecast summary (for Section 7 summary card) ────────
  useEffect(() => {
    API.get("/analytics/forecast")
      .then((res) => setForecastSummary(res.data || null))
      .catch(() => setForecastSummary(null));
  }, []);

  const displayName = getUserDisplayName(profile);

  // ── All existing derived data (unchanged) ────────────────
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
      const rawDate = e?.date || e?.created_at;
      const ts = rawDate ? new Date(rawDate) : null;
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

  const hasAnyData = categories.length > 0 || trend.length > 0;
  const hasIncome  = incomeTrend.length > 0;

  // ── New derived values ───────────────────────────────────
  const totalExpenses = allExpenses.length;
  const userState     = totalExpenses < 10 ? "new" : totalExpenses < 30 ? "growing" : "established";

  const score = Number(health?.score ?? health?.health_score ?? 0);

  const savingsScore   = health?.breakdown?.savings   ?? Math.min(40, Math.round(score * 0.4));
  const budgetScore    = health?.breakdown?.budget     ?? Math.min(40, Math.round(score * 0.4));
  const stabilityScore = health?.breakdown?.stability  ?? Math.max(0, score - Math.min(40, Math.round(score * 0.4)) * 2);

  const scoreColor =
    score >= 70 ? { text: "text-emerald-600 dark:text-emerald-400", label: "Good",             bar: "bg-emerald-500" }
    : score >= 40 ? { text: "text-amber-600 dark:text-amber-400",   label: "Fair",             bar: "bg-amber-500"   }
    :               { text: "text-red-600 dark:text-red-400",        label: "Needs attention",  bar: "bg-red-500"     };

  const scoreSubtitle =
    savingsScore >= 32 && budgetScore < 24 ? "Strong savings, but budget discipline needs attention."
    : savingsScore >= 32 && budgetScore >= 24 ? "Excellent financial control this month."
    : "Spending and budget both need attention.";

  const parsedInsights = useMemo(() => {
    const data = { insight: "", risk: "", reason: "", action: "" };
    insightsList.forEach((line) => {
      if (!line) return;
      const [key, ...rest] = line.split(":");
      if (!key || !rest.length) return;
      const value = rest.join(":").trim();
      const n     = key.trim().toLowerCase();
      if (n.includes("insight"))                                                    data.insight = value;
      else if (n.includes("risk"))                                                  data.risk    = value;
      else if (n.includes("reason"))                                                data.reason  = value;
      else if (n === "action" || n.includes("suggested action") || n.includes("suggestion")) data.action = value;
    });
    return data;
  }, [insightsList]);

  const sortedPieData = useMemo(() => [...pieData].sort((a, b) => b.total - a.total), [pieData]);
  const totalSpent    = useMemo(() => pieData.reduce((s, d) => s + d.total, 0), [pieData]);
  const topCategory   = sortedPieData[0]?.category || null;

  const thisMonthExpenses = useMemo(() => {
    const cm = new Date().getMonth();
    const cy = new Date().getFullYear();
    return allExpenses.filter((e) => {
      const rawDate = e?.date || e?.created_at;
      const ts = rawDate ? new Date(rawDate) : null;
      return ts && ts.getMonth() === cm && ts.getFullYear() === cy;
    });
  }, [allExpenses]);

  const thisMonthSpent = useMemo(
    () => thisMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [thisMonthExpenses]
  );

  const daysElapsed        = new Date().getDate();
  const daysInMonth        = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthEndProjection = daysElapsed > 0 ? Math.round((thisMonthSpent / daysElapsed) * daysInMonth) : 0;

  const totalBudget    = budgetData.reduce((s, b) => s + Number(b.limit || b.amount || b.allocated || 0), 0);
  const budgetPct      = totalBudget > 0 ? Math.min(120, Math.round((thisMonthSpent / totalBudget) * 100)) : 0;
  const budgetOver     = thisMonthSpent > totalBudget && totalBudget > 0;
  const budgetRemaining = totalBudget - thisMonthSpent;

  const forecast7      = forecastSummary?.forecast_7 || [];
  const forecast7Total = forecast7.reduce((s, f) => s + (f.yhat || 0), 0);
  const forecast7Avg   = forecast7.length > 0 ? forecast7Total / forecast7.length : 0;
  const forecast7Worst = forecast7.reduce((s, f) => s + (f.yhat_upper || 0), 0);

  // ── Health score counter animation ───────────────────────
  useEffect(() => {
    if (!score) return;
    let current = 0;
    const step = score / 60;
    const id   = setInterval(() => {
      current += step;
      if (current >= score) { setAnimatedScore(score); clearInterval(id); }
      else setAnimatedScore(Math.round(current));
    }, 20);
    return () => clearInterval(id);
  }, [score]);

  // ── AI explain (unchanged) ───────────────────────────────
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

  // ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-4">

      {/* ── SECTION 2: Page header ── */}
      <motion.div {...fadeUp(0)}>
        <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-app-muted">
              {displayName
                ? `${displayName}, here's what changed in your money this month.`
                : "Your financial trends and health at a glance."}
            </p>
            {memory?.frequent_category && (
              <p className="mt-1 text-xs font-medium text-gray-600 dark:text-app-subtle">
                Pattern: {memory.habit} in{" "}
                <span className="font-semibold">{memory.frequent_category}</span>
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
      </motion.div>

      {error && <AlertBanner message={error} onDismiss={() => setError("")} type="error" />}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2 h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
            <div className="lg:col-span-3 h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
            <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
        </div>

      ) : userState === "new" ? (

        /* ── STATE A: <10 expenses — setup checklist ── */
        <motion.div {...fadeUp(0.1)}>
          <div className={CARD}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-500/10">
                <BarChart3 className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  Set up your financial picture
                </p>
                <p className="text-xs text-gray-500 dark:text-app-muted">{totalExpenses}/10 expenses added</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  done:   hasIncome,
                  label:  "Add monthly income",
                  sub:    "Needed for savings rate and health score",
                  action: () => navigate("/"),
                },
                {
                  done:   totalExpenses >= 10,
                  label:  "Record 10 expenses",
                  sub:    `${totalExpenses}/10 added`,
                  action: () => navigate("/expenses"),
                },
                {
                  done:   hasBudgets,
                  label:  "Create a budget",
                  sub:    "Set category spending limits",
                  action: () => navigate("/budgets"),
                },
              ].map(({ done, label, sub, action }) => (
                <div
                  key={label}
                  role={done ? "presentation" : "button"}
                  tabIndex={done ? -1 : 0}
                  onClick={() => !done && action()}
                  onKeyDown={(e) => !done && e.key === "Enter" && action()}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                    done
                      ? "cursor-default border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                      : "cursor-pointer border-gray-200 bg-white hover:border-cyan-300 hover:shadow-sm dark:border-white/[0.08] dark:bg-app-surface dark:hover:border-cyan-500/40"
                  }`}
                >
                  <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-emerald-500 text-white" : "border-2 border-gray-300 dark:border-gray-600"
                  }`}>
                    {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${done ? "text-emerald-800 dark:text-emerald-300" : "text-gray-900 dark:text-white"}`}>
                      {label}
                    </p>
                    <p className={`text-xs ${done ? "text-emerald-600 dark:text-emerald-400/80" : "text-gray-400 dark:text-app-muted"}`}>
                      {sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs leading-relaxed text-gray-400 dark:text-app-muted">
              Once complete, FinPulse will show spending patterns, anomaly alerts, forecasts and AI recommendations.
            </p>
          </div>
        </motion.div>

      ) : (

        /* ── STATES B & C: Growing + Established ── */
        <>
          {/* Estimated score banner */}
          {(!hasIncome || !hasBudgets) && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Health score is estimated</p>
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
              SECTION 3 — Financial Health + AI Recommendation
          ══════════════════════════════════════════════ */}
          <motion.div {...fadeUp(0.1)}>
            <div className="grid gap-4 lg:grid-cols-5">

              {/* LEFT: Health score card (col-span-2) */}
              <div className={`lg:col-span-2 ${CARD}`}>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
                  Financial Health
                </p>

                <div className="mb-1 flex items-end gap-3">
                  <span className={`font-mono text-5xl font-bold tabular-nums ${scoreColor.text}`}>
                    {animatedScore}
                  </span>
                  <span className={`mb-1.5 text-sm font-semibold ${scoreColor.text}`}>{scoreColor.label}</span>
                </div>
                <p className="mb-4 text-xs text-gray-500 dark:text-app-muted">{scoreSubtitle}</p>

                {/* Score breakdown bars */}
                <div className="space-y-3">
                  {[
                    { label: "Savings",       value: savingsScore,   max: 40, color: "bg-emerald-500" },
                    { label: "Budget control", value: budgetScore,    max: 40, color: budgetScore < 24 ? "bg-amber-500" : "bg-emerald-500" },
                    { label: "Consistency",   value: stabilityScore, max: 20, color: "bg-cyan-500" },
                  ].map(({ label, value, max, color }) => {
                    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
                    return (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-app-subtle">{label}</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {value}/{max}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <motion.div
                            className={`h-1.5 rounded-full ${color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 text-[10px] text-gray-400 dark:text-app-muted">
                  Based on {totalExpenses} recorded expenses. Add more for higher accuracy.
                </p>

                {/* Why this score */}
                {reasons.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-app-subtle">Why this score?</p>
                    {reasons.slice(0, 3).map((r, i) => {
                      const lower = r.toLowerCase();
                      const isWarn = lower.includes("overspent") || lower.includes("exceeded") || lower.includes("risk");
                      const isGood = lower.includes("good") || lower.includes("within") || lower.includes("saved");
                      const cls = isWarn
                        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
                        : isGood
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20";
                      const dot = isWarn ? "bg-red-500" : isGood ? "bg-emerald-500" : "bg-amber-500";
                      return (
                        <div key={i} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${cls}`}>
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                          <span className="leading-relaxed">{r}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: AI Recommendation card (col-span-3) */}
              <div className={`lg:col-span-3 ${CARD} flex flex-col`}>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-500/10">
                    <Sparkles className="h-4 w-4 text-cyan-500" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">AI Recommendation</p>
                </div>

                {insightsList.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center dark:border-white/[0.10] dark:bg-white/[0.03]">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-app-subtle">No insights yet</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">
                        Add more expenses to unlock AI-powered spending insights.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Insight + reason combined */}
                    {(parsedInsights.insight || parsedInsights.reason) && (
                      <p className="mb-3 text-sm leading-relaxed text-gray-700 dark:text-app-subtle">
                        {parsedInsights.insight}
                        {parsedInsights.reason && parsedInsights.insight ? " " : ""}
                        {parsedInsights.reason}
                      </p>
                    )}

                    {/* Why it matters */}
                    {parsedInsights.risk && (
                      <div className="mb-3 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2.5 dark:border-red-500/20 dark:bg-red-500/10">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400">
                          Why it matters
                        </p>
                        <p className="mt-1 text-xs text-red-700 dark:text-red-300">{parsedInsights.risk}</p>
                      </div>
                    )}

                    {/* Suggested action highlight */}
                    {parsedInsights.action && (
                      <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 dark:border-cyan-500/20 dark:bg-cyan-500/10">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                          Suggested Action
                        </p>
                        <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-300">{parsedInsights.action}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-auto flex flex-wrap gap-2">
                      {topCategory && (
                        <button type="button" onClick={() => navigate("/expenses")} className={BTN_PRIMARY}>
                          Review {titleCase(topCategory)} Expenses
                        </button>
                      )}
                      <button type="button" onClick={() => navigate("/budgets")} className={BTN_SECONDARY}>
                        Adjust Budget
                      </button>
                    </div>

                    {/* Expandable accordion */}
                    <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setExpandAccordion((v) => !v)}
                        className="flex w-full items-center justify-between text-xs font-medium text-gray-500 transition hover:text-gray-700 dark:text-app-muted dark:hover:text-app-subtle"
                      >
                        <span>Why did FinPulse suggest this?</span>
                        {expandAccordion
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <AnimatePresence>
                        {expandAccordion && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-1.5">
                              {reasons.slice(0, 3).map((r, i) => (
                                <p key={i} className="text-xs text-gray-500 dark:text-app-muted">• {r}</p>
                              ))}
                              {parsedInsights.risk && (
                                <p className="text-xs text-gray-500 dark:text-app-muted">
                                  • {parsedInsights.risk}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════
              SECTION 4 — This Month Snapshot
          ══════════════════════════════════════════════ */}
          <motion.div {...fadeUp(0.2)}>
            <div className="grid gap-4 lg:grid-cols-2">

              {/* This Month */}
              <div className={CARD}>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
                  This Month
                </p>
                <div className="mb-3 flex items-end gap-2">
                  <span className="font-mono text-3xl font-bold text-gray-900 dark:text-white">
                    {formatINR(thisMonthSpent)}
                  </span>
                  <span className="mb-0.5 text-xs text-gray-400 dark:text-app-muted">spent</span>
                </div>
                {topCategory && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-app-muted">Top category:</span>
                    <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                      {titleCase(topCategory)}
                    </span>
                  </div>
                )}
                {health?.savings_rate != null && (
                  <p className="mb-1 text-xs text-gray-500 dark:text-app-muted">
                    Savings rate:{" "}
                    <span className="font-semibold text-gray-700 dark:text-app-subtle">
                      {Number(health.savings_rate).toFixed(1)}%
                    </span>
                    <span className="ml-1 text-gray-400 dark:text-app-muted">(based on recorded expenses only)</span>
                  </p>
                )}
                {monthEndProjection > 0 && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-app-muted">
                    At this rate, you'll spend{" "}
                    <span className="font-semibold text-gray-600 dark:text-app-subtle">
                      {formatINR(monthEndProjection)}
                    </span>{" "}
                    by month end
                  </p>
                )}
              </div>

              {/* Budget Status */}
              <div className={CARD}>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
                  Budget Status
                </p>
                {!hasBudgets ? (
                  <div className="flex flex-col items-start gap-3 py-2">
                    <p className="text-sm text-gray-500 dark:text-app-muted">No budget set yet</p>
                    <button type="button" onClick={() => navigate("/budgets")} className={BTN_PRIMARY}>
                      Create Budget
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex justify-between text-xs text-gray-500 dark:text-app-muted">
                      <span>Spent {formatINR(thisMonthSpent)}</span>
                      <span>of {formatINR(totalBudget)}</span>
                    </div>
                    <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <motion.div
                        className={`h-2.5 rounded-full ${
                          budgetPct > 100 ? "bg-red-500" : budgetPct > 80 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(budgetPct, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <p className={`mb-3 text-xs font-semibold ${
                      budgetOver ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {budgetOver
                        ? `₹${Math.abs(budgetRemaining).toLocaleString("en-IN")} over budget`
                        : `₹${Math.abs(budgetRemaining).toLocaleString("en-IN")} remaining`}
                    </p>
                    <button type="button" onClick={() => navigate("/budgets")} className={BTN_SECONDARY}>
                      View Budgets
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════
              SECTION 5 — Spending by Category
          ══════════════════════════════════════════════ */}
          {sortedPieData.length > 0 && (
            <motion.div {...fadeUp(0.3)}>
              <div className="grid gap-4 lg:grid-cols-5">

                {/* Donut chart */}
                <div className={`lg:col-span-2 ${CARD} flex flex-col`}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
                    Breakdown
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={sortedPieData}
                        dataKey="total"
                        nameKey="category"
                        cx="50%" cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                      >
                        {sortedPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatINR(v)} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {sortedPieData.slice(0, 5).map((d, i) => (
                      <span key={d.category} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-app-muted">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        {titleCase(d.category)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ranked category list */}
                <div className={`lg:col-span-3 ${CARD}`}>
                  <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Where your money went
                  </p>
                  <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">
                    {sortedPieData.map((d, i) => {
                      const pct   = totalSpent > 0 ? Math.round((d.total / totalSpent) * 100) : 0;
                      const color = PIE_COLORS[i % PIE_COLORS.length];
                      return (
                        <motion.div
                          key={d.category}
                          variants={staggerItem}
                          className="cursor-pointer rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                          onClick={() => navigate("/expenses")}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-700 dark:text-app-subtle">
                              {titleCase(d.category)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                                {formatINR(d.total)}
                              </span>
                              <span className="w-8 text-right text-[10px] text-gray-400 dark:text-app-muted">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                            <motion.div
                              className="h-1.5 rounded-full"
                              style={{ background: color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  <p className="mt-3 text-[10px] text-gray-400 dark:text-app-muted">
                    Tap a category to view those expenses
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════
              SECTION 6 — Spending Trend + Income
          ══════════════════════════════════════════════ */}
          <motion.div {...fadeUp(0.4)}>
            <div className="grid gap-4 lg:grid-cols-2">

              {/* Monthly spend trend */}
              <div className={CARD}>
                <p className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">Monthly spend trend</p>
                <p className="mb-3 text-xs text-gray-400 dark:text-app-muted">Total spend by calendar month</p>
                {trendData.length < 3 ? (
                  <div className="rounded-xl bg-gray-50 px-4 py-5 dark:bg-white/[0.03]">
                    {trendData.length > 0 ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {trendData[trendData.length - 1]?.label} —{" "}
                          {formatINR(trendData[trendData.length - 1]?.total || 0)} spent
                        </p>
                        {topCategory && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">
                            Top: {titleCase(topCategory)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-app-muted">No expense data yet.</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400 dark:text-app-muted">
                      Monthly trend will appear after 3 months of data
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [formatINR(v), "Spent"]} contentStyle={tooltipStyle} />
                      <Line
                        type="monotone" dataKey="total" stroke="#06B6D4" strokeWidth={2.5}
                        dot={{ r: 4, fill: "#06B6D4" }} activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Income over time */}
              <div className={CARD}>
                <p className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">Income over time</p>
                <p className="mb-3 text-xs text-gray-400 dark:text-app-muted">Your earning trends</p>
                {incomeChartData.length < 2 ? (
                  <div className="flex flex-col items-start gap-3 rounded-xl bg-gray-50 px-4 py-5 dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-500 dark:text-app-muted">
                      Income trend appears after 2 months of entries
                    </p>
                    <button type="button" onClick={() => navigate("/")} className={BTN_PRIMARY}>
                      Add Income
                    </button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={incomeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [formatINR(v), "Income"]} contentStyle={tooltipStyle} />
                      <Line
                        type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5}
                        dot={{ r: 4, fill: "#10B981" }} activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════
              SECTION 6.5 — Spending Heatmap
          ══════════════════════════════════════════════ */}
          <SpendingHeatmap expenses={allExpenses} />

          {/* ══════════════════════════════════════════════
              SECTION 7 — Forecast (established only)
          ══════════════════════════════════════════════ */}
          {userState === "established" && (
            <motion.div {...fadeUp(0.5)}>
              <div className={CARD}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
                      Expected spending
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">Next 7 days</p>
                  </div>
                  {forecast7Total > 0 && (
                    <div className="text-right">
                      <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
                        {formatINR(Math.round(forecast7Total))}
                      </p>
                      {totalBudget > 0 && (
                        <p className={`text-xs font-medium ${
                          forecast7Total > totalBudget ? "text-red-500" : "text-emerald-500"
                        }`}>
                          {forecast7Total > totalBudget
                            ? `Likely over budget by ${formatINR(Math.round(forecast7Total - totalBudget))}`
                            : "Within budget"}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {forecast7.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      { label: "Next 7d Total", value: formatINR(Math.round(forecast7Total)) },
                      { label: "Avg / Day",     value: formatINR(Math.round(forecast7Avg))   },
                      { label: "Worst Case",    value: formatINR(Math.round(forecast7Worst))  },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
                          {label}
                        </p>
                        <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowFullForecast((v) => !v)}
                  className="text-xs font-semibold text-cyan-600 transition hover:text-cyan-500 dark:text-cyan-400"
                >
                  {showFullForecast ? "Hide full forecast" : "See full forecast →"}
                </button>

                <AnimatePresence>
                  {showFullForecast && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                        <ForecastChart />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════
              SECTION 8 — Recurring expenses
          ══════════════════════════════════════════════ */}
          {recurring.length > 0 && (
            <motion.div {...fadeUp(0.6)}>
              <div className={CARD}>
                <p className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  Recurring expense detection
                </p>
                <p className="mb-3 text-xs text-gray-400 dark:text-app-muted">
                  Repeated charges spotted across months
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {recurring.map((r) => (
                    <div
                      key={`${r.title}-${r.amount}-${r.occurrences}`}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
                    >
                      <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{r.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-app-muted">
                        ~{formatINR(r.amount)} · {r.occurrences} times · {r.months} months
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigate("/expenses")}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/[0.08] dark:text-app-muted dark:hover:bg-white/5"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/budgets")}
                          className="rounded-lg bg-cyan-500 px-2.5 py-1 text-[10px] font-semibold text-[#06080F] transition hover:bg-cyan-400"
                        >
                          Set budget
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════
              SECTION 8 — Explore More
          ══════════════════════════════════════════════ */}
          <motion.div {...fadeUp(0.7)}>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
              Explore More
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon:     <Repeat className="h-5 w-5 text-cyan-500" />,
                  title:    "Recurring Payments",
                  sub:      recurring.length > 0
                              ? `${recurring.length} pattern${recurring.length > 1 ? "s" : ""} detected`
                              : "No patterns yet",
                  disabled: recurring.length === 0,
                  action:   () => {},
                },
                {
                  icon:     <TrendingUp className="h-5 w-5 text-emerald-500" />,
                  title:    "Income Trend",
                  sub:      "Your earnings over time",
                  disabled: false,
                  action:   () => {},
                },
                {
                  icon:   <Zap className="h-5 w-5 text-violet-500" />,
                  title:  "Merchant Insights",
                  sub:    "Where you shop most",
                  badge:  "Coming soon",
                  disabled: true,
                  action: () => {},
                },
              ].map(({ icon, title, sub, badge, disabled, action }) => (
                <motion.div
                  key={title}
                  whileHover={{ y: disabled ? 0 : -3 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => !disabled && action()}
                  className={`rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.05] dark:bg-app-card transition-all ${
                    disabled ? "cursor-default opacity-60" : "cursor-pointer hover:shadow-sm"
                  }`}
                >
                  <div className="mb-2">{icon}</div>
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{title}</p>
                    {badge && (
                      <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[8px] font-semibold text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-gray-400 dark:text-app-muted">{sub}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
