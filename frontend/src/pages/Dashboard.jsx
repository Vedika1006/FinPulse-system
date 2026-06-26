import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import {
  Wallet, Check, TrendingUp, TrendingDown,
  PiggyBank, AlertTriangle,
} from "lucide-react";
import {
  getHealthScore,
  getMonthlyTrend,
  getCategoryData,
  getRecentExpenses,
} from "../api/dashboard";
import API from "../api/axios";
import { formatCurrency as globalFormatCurrency } from "../utils/currency";
import { useToast } from "../components/ToastProvider";
import { getUserDisplayName } from "../utils/auth";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import {
  BarChart, Bar, Rectangle, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from "recharts";
import { monthLabel } from "../utils/month";
import WhatIfSimulator from "../components/WhatIfSimulator";
import SpendingForecast from "../components/SpendingForecast";
import BehaviorCard from "../components/BehaviorCard";
import AnomalyAlerts from "../components/AnomalyAlerts";

// ── Time-based greeting ─────────────────────────────────────
// Returns "Good morning", "Good afternoon", or "Good evening"
// based on the current hour. Displayed in the hero banner.
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// ── Health score color helper ───────────────────────────────
// Returns a Tailwind color class based on the score value.
// Used in both the hero banner number and progress bar.
const healthColor = (score) => {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-cyan-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
};
const healthBarColor = (score) => {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-cyan-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
};
const healthLabel = (score) => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs attention";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, currency, currencySymbol } = useTheme();
  const { showToast } = useToast();

  const [health,               setHealth]               = useState(0);
  const [trend,                setTrend]                = useState([]);
  const [category,             setCategory]             = useState([]);
  const [expenses,             setExpenses]             = useState([]);
  const [explaining,           setExplaining]           = useState("");
  const [profile,              setProfile]              = useState(null);
  const [loading,              setLoading]              = useState(true);
  const [memory,               setMemory]               = useState(null);
  const [income,               setIncome]               = useState(null);
  const [incomeModal,          setIncomeModal]          = useState(false);
  const [incomeAmount,         setIncomeAmount]         = useState("");
  const [aiExplainOpen,        setAiExplainOpen]        = useState(false);
  const [aiExplainText,        setAiExplainText]        = useState("");
  const [hoveredMonthLabel,    setHoveredMonthLabel]    = useState("");
  const [chartModalOpen,       setChartModalOpen]       = useState(false);
  const [clickedMonth,         setClickedMonth]         = useState(null);
  const [selectedMonth,        setSelectedMonth]        = useState(null);
  const [allExpenses,          setAllExpenses]          = useState([]);
  const [incomeByMonth,        setIncomeByMonth]        = useState({});
  const [selectedCats,         setSelectedCats]         = useState(() => new Set());
  const [weeklyAction,         setWeeklyAction]         = useState("");
  const [weeklyActionLoading,  setWeeklyActionLoading]  = useState(false);
  const [hasBudgets,           setHasBudgets]           = useState(false);
  const [onboardingDismissed,  setOnboardingDismissed]  = useState(
    () => localStorage.getItem("onboarding_done") === "true"
  );

  // Track dark mode by observing the <html> class list
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // ── Main data fetch on mount ────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const me = await API.get("/auth/me");
        setProfile(me.data || null);
      } catch { setProfile(null); }

      try {
        const mem = await API.get("/analytics/memory/");
        setMemory(mem.data || null);
      } catch { setMemory(null); }

      try {
        const m = new Date().toISOString().slice(0, 7);
        const inc = await API.get(`/income/${m}/`);
        setIncome(inc.data || null);
      } catch { setIncome(null); }

      try {
        const h = await getHealthScore();
        setHealth(h.health_score ?? 0);
      } catch (err) { console.error(err); }

      try {
        const [t, c, e, bdg] = await Promise.all([
          getMonthlyTrend(),
          getCategoryData(),
          getRecentExpenses(),
          API.get("/budgets/"),
        ]);
        setTrend(t);
        setCategory(c);
        setExpenses(e);
        setHasBudgets(Array.isArray(bdg.data) && bdg.data.length > 0);
      } catch (err) { console.error(err); }

      try {
        const [expRes, incRes] = await Promise.all([
          API.get("/expenses/"),
          API.get("/income/"),
        ]);
        setAllExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        const map = {};
        for (const row of Array.isArray(incRes.data) ? incRes.data : []) {
          if (row?.month) map[String(row.month)] = Number(row.amount || 0);
        }
        setIncomeByMonth(map);
      } catch {} finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value) => globalFormatCurrency(value, currency);

  // ── Derived totals ──────────────────────────────────────────
  const totalExpenses = category.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const totalCredit   = income?.amount ? Number(income.amount) : 0;
  const savings       = totalCredit - totalExpenses;

  // ── Alert banners (Smart Alerts section) ───────────────────
  // Emoji removed from strings here — AlertTriangle icon is
  // added in JSX instead for consistency with the icon system.
  const alerts = useMemo(() => {
    const a = [];
    if (health < 50) a.push({ tone: "yellow", text: "Your financial health score is below target." });
    if (income?.amount && totalExpenses > totalCredit)
      a.push({ tone: "red", text: "You exceeded your recorded monthly income." });
    if ((memory?.meta?.month_total_budget || 0) > 0 && (memory?.meta?.month_overspend || 0) > 0) {
      a.push({
        tone: "red",
        text: `Budget almost exceeded (over by ${currencySymbol}${Number(memory.meta.month_overspend).toFixed(0)})`,
      });
    }
    return a.length
      ? a.slice(0, 3)
      : [{ tone: "yellow", text: "Spending is stable. Keep monitoring weekly variance." }];
  }, [health, income, totalExpenses, totalCredit, memory, currencySymbol]);

  // ── Chart styling ───────────────────────────────────────────
  const chartTooltipStyle = isDark
    ? { borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "#0D1420", color: "#CBD5E1" }
    : { borderRadius: "12px", border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#111827" };
  const chartAxisTick = { fill: isDark ? "#64748B" : "#6B7280", fontSize: 11 };
  const chartGrid     = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const legendStyle   = { color: isDark ? "#CBD5E1" : "#374151", fontSize: "12px" };

  // ── Weekly report logic ─────────────────────────────────────
  const latestTrend   = trend.length ? Number(trend[trend.length - 1]?.total || 0) : 0;
  const prevTrend     = trend.length > 1 ? Number(trend[trend.length - 2]?.total || 0) : 0;
  const trendDeltaPct = prevTrend > 0 ? ((latestTrend - prevTrend) / prevTrend) * 100 : 0;

  const displayName = getUserDisplayName(profile);

  const _startOfWeekMonday = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    return x;
  };

  const weekly = useMemo(() => {
    const now     = Date.now();
    const dayMs   = 86400000;
    const startThis = now - 7 * dayMs;
    const startPrev = now - 14 * dayMs;

    const rows = Array.isArray(allExpenses) && allExpenses.length
      ? allExpenses
      : Array.isArray(expenses) ? expenses : [];

    let thisTotal = 0;
    let prevTotal = 0;
    const catTotals = new Map();

    for (const e of rows) {
      const amt = Number(e.amount || 0);
      const ts  = e.created_at ? new Date(e.created_at).getTime() : NaN;
      if (!Number.isFinite(ts)) continue;
      if (ts >= startThis) {
        thisTotal += amt;
        const c = String(e.category || "Other");
        catTotals.set(c, (catTotals.get(c) || 0) + amt);
      } else if (ts >= startPrev && ts < startThis) {
        prevTotal += amt;
      }
    }

    let topCategory = null;
    let topAmount   = 0;
    for (const [c, v] of catTotals.entries()) {
      if (v > topAmount) { topAmount = v; topCategory = c; }
    }

    const pct  = prevTotal > 0 ? ((thisTotal - prevTotal) / prevTotal) * 100 : 0;
    const risk = health < 45 || (memory?.habit || "").toLowerCase().includes("overspend")
      ? "High"
      : health < 65 || pct > 15 ? "Medium" : "Low";

    return { thisTotal, prevTotal, pct, topCategory, risk };
  }, [allExpenses, expenses, health, memory]);

  const weeklyBars = useMemo(() => {
    const rows  = Array.isArray(allExpenses) ? allExpenses : [];
    const start = _startOfWeekMonday(new Date());
    const end   = new Date(start);
    end.setDate(end.getDate() + 7);

    const days   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = new Array(7).fill(0);

    for (const e of rows) {
      const ts = e?.created_at ? new Date(e.created_at) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (ts < start || ts >= end) continue;
      const js  = ts.getDay();
      const idx = js === 0 ? 6 : js - 1;
      totals[idx] += Number(e?.amount || 0);
    }

    const avg           = totals.reduce((a, b) => a + b, 0) / 7;
    const currentJsDay  = new Date().getDay();
    const currentIdx    = currentJsDay === 0 ? 6 : currentJsDay - 1;

    return days.map((label, i) => ({
      day:      label,
      spent:    Number(totals[i].toFixed(2)),
      isHigh:   avg > 0 ? totals[i] > avg * 1.6 : false,
      isFuture: i > currentIdx,
    }));
  }, [allExpenses]);

  const cashflowPrediction = useMemo(() => {
    const weeklyAvg = Number(weekly.thisTotal || 0) / 7;
    return Math.round(weeklyAvg * 28);
  }, [weekly]);

  // Emoji removed from strings — icon is rendered in JSX
  const smartAlerts = useMemo(() => {
    const a = [];
    if (weekly.prevTotal > 0 && weekly.pct >= 30)
      a.push(`You spent ${weekly.pct.toFixed(0)}% more than last week`);
    if ((memory?.meta?.month_total_budget || 0) > 0 && (memory?.meta?.month_overspend || 0) > 0)
      a.push(`Budget almost exceeded (over by ₹${Number(memory.meta.month_overspend).toFixed(0)})`);
    return a.slice(0, 2);
  }, [weekly, memory]);

  // ── AI explanation helper ───────────────────────────────────
  const askAIExplain = async (section, context) => {
    if (explaining) return;
    setExplaining(section);
    try {
      const res = await API.post("/ai/chat", {
        message: "Explain this",
        context,
        data: {
          page: "dashboard",
          section,
          healthScore:  Number(health || 0),
          trend,
          totalCredit:  Number(totalCredit || 0),
          totalDebit:   Number(totalExpenses || 0),
          savings:      Number(savings || 0),
          budgets:      memory?.meta?.month_total_budget
            ? { total_budget: memory.meta.month_total_budget } : null,
        },
      });
      setAiExplainText(res.data?.reply || "No explanation available.");
      setAiExplainOpen(true);
      showToast("AI explanation ready", "success", { onClick: () => setAiExplainOpen(true) });
    } catch {
      showToast("Could not fetch AI explanation", "error");
    } finally {
      setExplaining("");
    }
  };

  // ── Income save ─────────────────────────────────────────────
  const saveIncome = async () => {
    const month = new Date().toISOString().slice(0, 7);
    const amt   = Number(incomeAmount);
    if (!amt || amt <= 0) return;
    try {
      const res = await API.post("/income/", { month, amount: amt });
      setIncome(res.data || null);
      showToast("Income saved", "success");
      setIncomeModal(false);
      setIncomeAmount("");
    } catch {
      showToast("Could not save income", "error");
    }
  };

  // ── Trend chart data ────────────────────────────────────────
  const trendData = useMemo(() => {
    const currMonthNum = new Date().getMonth() + 1;
    return (Array.isArray(trend) ? trend : []).map((row) => {
      const m       = Number(row.month);
      const expense = Number(row.total || 0);
      const inc     = income?.amount ? (m === currMonthNum ? Number(income.amount) : 0) : null;
      const sv      = inc == null ? null : Number(inc) - Number(expense || 0);
      return { month: m, label: monthLabel(m), expense, income: inc, savings: sv };
    });
  }, [trend, income]);

  const monthOptions = useMemo(
    () => trendData.map((r) => ({ value: Number(r.month), label: r.label })).filter((r) => Number.isFinite(r.value)),
    [trendData]
  );

  const selectedMonthNum = selectedMonth ?? clickedMonth ?? (monthOptions[monthOptions.length - 1]?.value || null);

  const monthExpenses = useMemo(() => {
    const m = Number(selectedMonthNum);
    if (!m || !Array.isArray(allExpenses)) return [];
    return allExpenses.filter((e) => {
      const ts = e?.created_at ? new Date(e.created_at) : null;
      return ts && !Number.isNaN(ts.getTime()) && ts.getMonth() + 1 === m;
    });
  }, [allExpenses, selectedMonthNum]);

  const categoriesInMonth = useMemo(() => {
    const set = new Set();
    for (const e of monthExpenses) {
      const c = String(e?.category || "").trim().toLowerCase();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [monthExpenses]);

  const effectiveSelectedCats = useMemo(() => {
    if (!selectedCats || selectedCats.size === 0) return new Set(categoriesInMonth);
    return selectedCats;
  }, [selectedCats, categoriesInMonth]);

  const filteredMonthExpenses = useMemo(
    () => monthExpenses.filter((e) => effectiveSelectedCats.has(String(e?.category || "").trim().toLowerCase())),
    [monthExpenses, effectiveSelectedCats]
  );

  const monthTotals = useMemo(() => {
    const expenseTotal = filteredMonthExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    const year         = new Date().getFullYear();
    const monthStr     = selectedMonthNum ? `${year}-${String(selectedMonthNum).padStart(2, "0")}` : "";
    const inc          = monthStr && incomeByMonth[monthStr] != null ? Number(incomeByMonth[monthStr] || 0) : 0;
    return { monthStr, expenseTotal, incomeTotal: inc, savings: inc - expenseTotal };
  }, [filteredMonthExpenses, incomeByMonth, selectedMonthNum]);

  const titleCaseCategory = (value) =>
    String(value || "").split(/[\s_-]+/g).filter(Boolean)
      .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  const resetChartFilters = () => {
    const m = clickedMonth ?? selectedMonthNum;
    setSelectedMonth(m);
    const monthCats = new Set(
      allExpenses
        .filter((e) => {
          const ts = e?.created_at ? new Date(e.created_at) : null;
          return ts && !Number.isNaN(ts.getTime()) && ts.getMonth() + 1 === Number(m);
        })
        .map((e) => String(e?.category || "").trim().toLowerCase())
        .filter(Boolean)
    );
    setSelectedCats(monthCats);
  };

  // Reload detail data when the month-drill modal opens
  useEffect(() => {
    if (!chartModalOpen) return;
    (async () => {
      try {
        const res = await API.get("/expenses/");
        setAllExpenses(Array.isArray(res.data) ? res.data : []);
      } catch { setAllExpenses([]); }
      try {
        const inc = await API.get("/income/");
        const map = {};
        for (const row of Array.isArray(inc.data) ? inc.data : []) {
          if (row?.month) map[String(row.month)] = Number(row.amount || 0);
        }
        setIncomeByMonth(map);
      } catch { setIncomeByMonth({}); }
    })();
  }, [chartModalOpen]);

  // ── Trend chart tooltip ─────────────────────────────────────
  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const row       = payload[0]?.payload || {};
    const incomeVal = row.income == null ? null : Number(row.income || 0);
    const expenseVal = Number(row.expense || 0);
    const savingsVal = incomeVal == null ? null : incomeVal - expenseVal;
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-white/[0.08] dark:bg-app-surface dark:text-white" style={{ maxWidth: 240 }}>
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

  // ── Weekly suggested action extraction helper ───────────────
  const _extractWeeklySuggestedAction = (reply) => {
    const lines = String(reply || "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
    let inAction = false;
    for (const ln of lines) {
      if (!ln) continue;
      if (/^Action Plan:$/i.test(ln)) { inAction = true; continue; }
      if (inAction && /^(Summary|Top Issues|Spending Breakdown|Priority|Steps):/i.test(ln)) inAction = false;
      if (inAction && /^[-•*]\s+/.test(ln)) return ln.replace(/^[-•*]\s+/, "").trim();
    }
    return "";
  };

  // ── Weekly AI action — with 1-hour localStorage cache ──────
  // On each Dashboard load, we first check localStorage for a
  // cached action. If it exists and is < 1 hour old we use it
  // immediately without calling the API. Otherwise we call Groq,
  // then write the result back to the cache. This prevents
  // burning API tokens on every page refresh.
  useEffect(() => {
    const hasData = weekly.thisTotal > 0 || weekly.prevTotal > 0;
    if (!hasData || weeklyActionLoading || weeklyAction) return;

    const CACHE_KEY = "finpulse_weekly_action";
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { value, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL && value) {
          setWeeklyAction(value);
          return;
        }
      }
    } catch {}

    (async () => {
      setWeeklyActionLoading(true);
      try {
        const res = await API.post("/ai/chat", {
          message: "Give one suggested action for this weekly spending report.",
          context: "Dashboard weekly financial report",
          data: {
            name: displayName,
            weekly: {
              spending_change_pct:      Number(weekly.pct || 0),
              total_weekly_expense:     Number(weekly.thisTotal || 0),
              top_category:             weekly.topCategory,
              risk_level:               weekly.risk,
              cashflow_prediction_month: cashflowPrediction,
              daily:                    weeklyBars,
            },
          },
        });
        const reply     = res.data?.reply || "";
        const suggested = _extractWeeklySuggestedAction(reply) || "";
        const action    = suggested || "Set a budget for your top category and reduce spend by ₹500 this week.";
        setWeeklyAction(action);
        // Write to cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ value: action, ts: Date.now() }));
        } catch {}
      } catch {
        setWeeklyAction("Set a budget for your top category and reduce spend by ₹500 this week.");
      } finally {
        setWeeklyActionLoading(false);
      }
    })();
  }, [weekly, weeklyBars, cashflowPrediction, displayName, weeklyActionLoading, weeklyAction]);

  // ── Onboarding state checks ─────────────────────────────────
  const hasIncomeState   = Boolean(income?.amount && Number(income.amount) > 0);
  const hasExpensesState = totalExpenses > 0 || (Array.isArray(allExpenses) && allExpenses.length > 0);
  const showOnboarding   = !onboardingDismissed && (!hasIncomeState || !hasExpensesState || !hasBudgets);

  useEffect(() => {
    if (hasIncomeState && hasExpensesState && hasBudgets && !onboardingDismissed) {
      const t = setTimeout(() => {
        localStorage.setItem("onboarding_done", "true");
        setOnboardingDismissed(true);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [hasIncomeState, hasExpensesState, hasBudgets, onboardingDismissed]);

  const handleDismissOnboarding = () => {
    localStorage.setItem("onboarding_done", "true");
    setOnboardingDismissed(true);
  };

  if (loading) return <DashboardSkeleton />;

  // ── Shared button class helpers ─────────────────────────────
  const btnPrimary   = "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 active:scale-[0.99]";
  const btnSecondary = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-app-card dark:text-app-subtle dark:hover:bg-white/5";

  return (
    <div className="mx-auto max-w-6xl space-y-6 overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════
          HERO BANNER
          Personalized greeting + date + cashflow prediction
          on the left. Health score with mini progress bar
          on the right. Replaces the abrupt jump into data.
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {getGreeting()}{displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-app-muted">
              {cashflowPrediction > 0 ? (
                <>On track to spend{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(cashflowPrediction)}
                  </span>{" "}this month.</>
              ) : (
                "Add expenses to see your monthly spending forecast."
              )}
            </p>
          </div>

          {/* Health score — only shown when data exists */}
          {health > 0 && (
            <div className="flex-shrink-0 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
                Health score
              </p>
              <p className={`mt-0.5 text-3xl font-semibold leading-none tabular-nums ${healthColor(health)}`}>
                {Math.round(health)}
              </p>
              <p className={`mt-1 text-[10px] font-medium ${healthColor(health)}`}>
                {healthLabel(health)}
              </p>
              {/* Progress bar — width driven by inline style so Tailwind purge doesn't strip it */}
              <div className="ml-auto mt-2 h-1 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${healthBarColor(health)}`}
                  style={{ width: `${Math.min(100, health)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          WEEKLY FINANCIAL REPORT
          Unchanged logic. Smart alerts now use AlertTriangle
          icon instead of ⚠️ emoji. Dark tokens updated.
          Chart bar width capped with maxBarSize.
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Financial Report</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-app-muted">A quick check-in for the last 7 days.</p>
          </div>
          {/* Smart alerts — icon replaces emoji */}
          {smartAlerts.length > 0 && (
            <div className="space-y-1 text-right">
              {smartAlerts.map((a, i) => (
                <div key={i} className="flex items-center justify-end gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden />
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5 KPI tiles */}
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            { label: "Change vs last week", value: weekly.prevTotal > 0 ? `${weekly.pct >= 0 ? "+" : ""}${weekly.pct.toFixed(0)}%` : "—" },
            { label: "Weekly expense",      value: weekly.thisTotal > 0 ? formatCurrency(weekly.thisTotal) : "—" },
            { label: "Top category",        value: weekly.topCategory ? String(weekly.topCategory) : "—" },
            { label: "Risk level",          value: weekly.risk },
            { label: "Suggested action",    value: weeklyActionLoading ? "Generating…" : weeklyAction || "—", small: true },
          ].map(({ label, value, small }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-app-card">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">{label}</p>
              <p className={`mt-2 font-semibold text-gray-900 dark:text-white ${small ? "text-sm leading-snug" : "text-xl tabular-nums"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Weekly bar chart */}
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-app-card">
          <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">This week (Mon–Sun)</p>
          {weeklyBars.every((d) => (d.spent || 0) === 0) ? (
            <p className="text-sm text-gray-500 dark:text-app-muted">No spending recorded this week yet.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBars} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap={12}>
                  <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${Number(v || 0).toFixed(0)}`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [formatCurrency(v), "Spent"]} labelFormatter={(l) => `Day: ${l}`} />
                  {/* maxBarSize prevents single-bar full-width rendering */}
                  <Bar dataKey="spent" name="Spent" radius={[8, 8, 0, 0]} maxBarSize={64} isAnimationActive animationDuration={700}>
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
          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(cashflowPrediction)}</span>{" "}
          this month.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════
          ONBOARDING / KPI CARDS
          Onboarding title updated from ExpenseAI → FinPulse.
          KPI cards now have icons and trend arrows.
      ══════════════════════════════════════════════════════ */}
      {showOnboarding ? (
        <div className="rounded-2xl border border-cyan-200/60 bg-cyan-50/30 p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-card">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                Welcome to FinPulse
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-app-muted">
                Set up your workspace in 3 steps.
              </p>
            </div>
            <button onClick={handleDismissOnboarding}
              className="text-xs font-medium text-gray-400 hover:text-gray-700 dark:text-app-muted dark:hover:text-white">
              Dismiss
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { done: hasIncomeState,   label: "Add your income",  sub: "Set a baseline for month",  action: () => setIncomeModal(true) },
              { done: hasExpensesState, label: "Add an expense",   sub: "Record a transaction",       action: () => navigate("/expenses") },
              { done: hasBudgets,       label: "Create a budget",  sub: "Set category limits",        action: () => navigate("/budgets") },
            ].map(({ done, label, sub, action }) => (
              <div key={label}
                role={done ? "presentation" : "button"}
                tabIndex={done ? -1 : 0}
                onClick={() => !done && action()}
                onKeyDown={(e) => !done && e.key === "Enter" && action()}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
                  done
                    ? "cursor-default border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                    : "cursor-pointer border-gray-200 bg-white shadow-sm hover:border-cyan-300 hover:shadow-md dark:border-white/[0.08] dark:bg-app-surface dark:hover:border-cyan-500/40"
                }`}
              >
                <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-emerald-500 text-white" : "border-2 border-gray-300 dark:border-gray-600"
                }`}>
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${done ? "text-emerald-800 dark:text-emerald-300" : "text-gray-900 dark:text-white"}`}>
                    {label}
                  </p>
                  <p className={`mt-0.5 text-xs ${done ? "text-emerald-600 dark:text-emerald-400/80" : "text-gray-400 dark:text-app-muted"}`}>
                    {sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (!income?.amount && totalExpenses === 0) ? (
        <EmptyState
          icon={Wallet}
          title="Welcome to FinPulse"
          description="Add your first income or expense to get started."
        />
      ) : (
        /* ── Upgraded KPI cards ──────────────────────────────
           Each card has a color-coded icon square, the value
           in large text, and a contextual sub-label.
           The expense card shows the week-over-week delta.
           The savings card shows savings rate when income exists.
        ─────────────────────────────────────────────────── */
        <div className="grid gap-4 md:grid-cols-3">
          {/* Income */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-500/10">
                <TrendingUp className="h-[18px] w-[18px] text-cyan-600 dark:text-cyan-400" aria-hidden />
              </div>
              {income?.amount && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  This month
                </span>
              )}
            </div>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Income</p>
            {income?.amount ? (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {formatCurrency(totalCredit)}
              </p>
            ) : (
              <button type="button" onClick={() => setIncomeModal(true)} className={`mt-2 ${btnPrimary} px-3 py-1.5 text-xs`}>
                Add income
              </button>
            )}
          </div>

          {/* Expenses */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10">
                <Wallet className="h-[18px] w-[18px] text-orange-600 dark:text-orange-400" aria-hidden />
              </div>
              {/* Week-over-week trend arrow */}
              {weekly.prevTotal > 0 && (
                <div className={`flex items-center gap-0.5 text-[10px] font-medium ${weekly.pct > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {weekly.pct > 0
                    ? <TrendingUp className="h-3 w-3" aria-hidden />
                    : <TrendingDown className="h-3 w-3" aria-hidden />}
                  {Math.abs(weekly.pct).toFixed(0)}% vs last week
                </div>
              )}
            </div>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Expenses</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(totalExpenses)}
            </p>
            {weekly.topCategory && (
              <p className="mt-1 text-xs text-gray-400 dark:text-app-muted">
                Top: {weekly.topCategory}
              </p>
            )}
          </div>

          {/* Savings */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl
              bg-emerald-50 dark:bg-emerald-500/10">
              <PiggyBank className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Savings</p>
            {income?.amount ? (
              <>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${savings < 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {formatCurrency(savings)}
                </p>
                {totalCredit > 0 && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-app-muted">
                    {((savings / totalCredit) * 100).toFixed(1)}% savings rate
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-sm text-gray-400 dark:text-app-muted">Add income to calculate</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MONTHLY TREND CHART
          maxBarSize={80} on both Bar components fixes the
          "solid red rectangle" bug when only one month of
          data exists. Income bars now teal, expense bars
          orange — less alarming than the original red.
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly trend</h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-app-muted">Income vs expenses by month.</p>
          </div>
          <button type="button" onClick={() => askAIExplain("monthly_trend", "Dashboard: monthly trend chart.")} className={btnSecondary}>
            {explaining === "monthly_trend" ? "Explaining…" : "Explain this"}
          </button>
        </div>

        {trendData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">No data yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">Add expenses to see your monthly trend.</p>
            <button type="button" onClick={() => navigate("/expenses")} className={`mt-4 ${btnPrimary}`}>
              Add Expense
            </button>
          </div>
        ) : (
          <div className="h-80">
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
                    radius={[8, 8, 0, 0]}
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

                {/* Expense bars — orange (not red) to be less alarming */}
                <Bar dataKey="expense" name="Expense" fill="#F97316"
                  radius={[8, 8, 0, 0]}
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

      {/* ══════════════════════════════════════════════════════
          SMART ALERTS
          AlertTriangle icon replaces ⚠️ emoji.
          Dark tokens updated.
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Alerts</h3>
          <button type="button" onClick={() => navigate("/analytics")} className={btnSecondary}>
            View details
          </button>
        </div>
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              a.tone === "red"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
            }`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              {a.text}
            </div>
          ))}
        </div>
      </div>

      {/* Anomaly Alerts + Behavior + WhatIf + Forecast */}
      <div className="mt-2">
        <AnomalyAlerts />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <BehaviorCard />
          <WhatIfSimulator income={Number(income?.amount || 0)} expense={totalExpenses} />
        </div>
        <SpendingForecast />
      </div>

      {/* ── Income modal ──────────────────────────────────── */}
      {incomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40 dark:bg-black/60"
            onClick={() => setIncomeModal(false)} aria-label="Close income modal" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-white/[0.08] dark:bg-app-card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add monthly income</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">Used to calculate savings and health score.</p>
            <input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)}
              type="number" min="0" step="1" placeholder="e.g. 85000"
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setIncomeModal(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-subtle dark:hover:bg-white/5">
                Cancel
              </button>
              <button onClick={saveIncome} className={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly drill-down modal ──────────────────────── */}
      <Modal open={chartModalOpen} onClose={() => setChartModalOpen(false)} title="Monthly details"
        footer={
          <>
            <button type="button" onClick={resetChartFilters}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-white/[0.08] dark:bg-transparent dark:text-white dark:hover:bg-white/5">
              Reset
            </button>
            <button type="button" onClick={() => setChartModalOpen(false)} className={btnPrimary}>
              Done
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-app-muted">Month</label>
              <select value={selectedMonthNum || ""}
                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedCats(new Set()); }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-500 dark:border-white/[0.08] dark:bg-app-surface dark:text-white"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-app-card">
              {[
                ["Income",  monthTotals.monthStr ? formatCurrency(monthTotals.incomeTotal) : "—"],
                ["Expense", formatCurrency(monthTotals.expenseTotal)],
                ["Savings", formatCurrency(monthTotals.savings)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-6">
                  <span className="text-xs text-gray-500 dark:text-app-muted">{label}</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-app-muted">Categories</p>
            {categoriesInMonth.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-app-muted">No expenses for this month.</p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-app-surface">
                {categoriesInMonth.map((cat) => (
                  <label key={cat} className="flex items-center justify-between gap-3 text-sm text-gray-900 dark:text-white">
                    <span className="flex-1">{titleCaseCategory(cat)}</span>
                    <input type="checkbox" checked={effectiveSelectedCats.has(cat)}
                      onChange={(e) => {
                        const next = new Set(effectiveSelectedCats);
                        e.target.checked ? next.add(cat) : next.delete(cat);
                        setSelectedCats(next);
                      }}
                      className="h-4 w-4 accent-cyan-500"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── AI explanation modal ──────────────────────────── */}
      <Modal open={aiExplainOpen} onClose={() => setAiExplainOpen(false)} title="AI Explanation"
        footer={
          <button type="button" onClick={() => setAiExplainOpen(false)} className={btnPrimary}>Close</button>
        }
      >
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-subtle">
          <pre className="whitespace-pre-wrap font-sans">{aiExplainText || "No explanation available."}</pre>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;