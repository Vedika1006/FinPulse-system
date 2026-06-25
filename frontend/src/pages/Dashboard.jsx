import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Wallet, Check } from "lucide-react";
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
  BarChart,
  Bar,
  Rectangle,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { monthLabel } from "../utils/month";
import WhatIfSimulator from "../components/WhatIfSimulator";
import SpendingForecast from "../components/SpendingForecast";
import BehaviorCard from "../components/BehaviorCard";
import AnomalyAlerts from "../components/AnomalyAlerts";

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, currency, currencySymbol } = useTheme();
  const { showToast } = useToast();
  const [health, setHealth] = useState(0);
  const [trend, setTrend] = useState([]);
  const [category, setCategory] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [explaining, setExplaining] = useState("");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memory, setMemory] = useState(null);
  const [income, setIncome] = useState(null);
  const [incomeModal, setIncomeModal] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState("");
  const [aiExplainOpen, setAiExplainOpen] = useState(false);
  const [aiExplainText, setAiExplainText] = useState("");
  const [hoveredMonthLabel, setHoveredMonthLabel] = useState("");
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [clickedMonth, setClickedMonth] = useState(null); // number (1-12)
  const [selectedMonth, setSelectedMonth] = useState(null); // number (1-12)
  const [allExpenses, setAllExpenses] = useState([]);
  const [incomeByMonth, setIncomeByMonth] = useState({});
  const [selectedCats, setSelectedCats] = useState(() => new Set());
  const [weeklyAction, setWeeklyAction] = useState("");
  const [weeklyActionLoading, setWeeklyActionLoading] = useState(false);
  
  const [hasBudgets, setHasBudgets] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("onboarding_done") === "true"
  );

  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const me = await API.get("/auth/me");
        setProfile(me.data || null);
      } catch {
        setProfile(null);
      }

      try {
        const mem = await API.get("/analytics/memory/");
        setMemory(mem.data || null);
      } catch {
        setMemory(null);
      }

      try {
        const m = new Date().toISOString().slice(0, 7);
        const inc = await API.get(`/income/${m}/`);
        setIncome(inc.data || null);
      } catch {
        setIncome(null);
      }

      try {
        const h = await getHealthScore();
        setHealth(h.health_score ?? 0);
      } catch (err) {
        console.error(err);
      }

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
      } catch (err) {
        console.error(err);
      }

      try {
        const [expRes, incRes] = await Promise.all([API.get("/expenses/"), API.get("/income/")]);
        setAllExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        const map = {};
        for (const row of Array.isArray(incRes.data) ? incRes.data : []) {
          if (row?.month) map[String(row.month)] = Number(row.amount || 0);
        }
        setIncomeByMonth(map);
      } catch {
        // Keep existing behavior if these fail.
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value) => globalFormatCurrency(value, currency);

  const totalExpenses = category.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const totalCredit = income?.amount ? Number(income.amount) : 0;
  const savings = totalCredit - totalExpenses;

  const alerts = useMemo(() => {
    const a = [];
    if (health < 50) a.push({ tone: "yellow", text: "Your financial health score is below target." });
    if (income?.amount && totalExpenses > totalCredit) a.push({ tone: "red", text: "You exceeded your recorded monthly income." });
    if ((memory?.meta?.month_total_budget || 0) > 0 && (memory?.meta?.month_overspend || 0) > 0) {
      a.push({ tone: "red", text: `Budget almost exceeded (over by ${currencySymbol}${Number(memory.meta.month_overspend).toFixed(0)})` });
    }
    return a.length ? a.slice(0, 3) : [{ tone: "yellow", text: "Spending is stable. Keep monitoring weekly variance." }];
  }, [health, income, totalExpenses, totalCredit, memory]);

  const chartTooltipStyle = isDark
    ? {
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(30,34,71,0.95)",
        color: "#E5E7EB",
      }
    : {
        borderRadius: "12px",
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        color: "#111827",
      };
  const chartAxisTick = { fill: isDark ? "#C9D1E3" : "#374151", fontSize: 12 };
  const chartGrid = isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";
  const legendStyle = { color: isDark ? "#C9D1E3" : "#374151" };
  const latestTrend = trend.length ? Number(trend[trend.length - 1]?.total || 0) : 0;
  const prevTrend = trend.length > 1 ? Number(trend[trend.length - 2]?.total || 0) : 0;
  const trendDeltaPct = prevTrend > 0 ? ((latestTrend - prevTrend) / prevTrend) * 100 : 0;
  const trendDirection = trendDeltaPct >= 0 ? "increased" : "decreased";
  const trendSummary =
    prevTrend > 0
      ? `Spending ${trendDirection} by ${Math.abs(trendDeltaPct).toFixed(1)}% vs last month.`
      : "Not enough month-over-month data yet.";

  const displayName = getUserDisplayName(profile);

  const _startOfWeekMonday = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = x.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // move to Monday
    x.setDate(x.getDate() + diff);
    return x;
  };

  // Weekly report (last 7 days vs previous 7 days) using full expenses.
  const weekly = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startThis = now - 7 * dayMs;
    const startPrev = now - 14 * dayMs;

    const rows = Array.isArray(allExpenses) && allExpenses.length ? allExpenses : Array.isArray(expenses) ? expenses : [];
    let thisTotal = 0;
    let prevTotal = 0;
    const catTotals = new Map();

    for (const e of rows) {
      const amt = Number(e.amount || 0);
      const ts = e.created_at ? new Date(e.created_at).getTime() : NaN;
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
    let topAmount = 0;
    for (const [c, v] of catTotals.entries()) {
      if (v > topAmount) {
        topAmount = v;
        topCategory = c;
      }
    }

    const pct = prevTotal > 0 ? ((thisTotal - prevTotal) / prevTotal) * 100 : 0;
    const risk =
      health < 45 || (memory?.habit || "").toLowerCase().includes("overspend")
        ? "High"
        : health < 65 || pct > 15
          ? "Medium"
          : "Low";

    return {
      thisTotal,
      prevTotal,
      pct,
      topCategory,
      risk,
    };
  }, [allExpenses, expenses, health, memory]);

  const weeklyBars = useMemo(() => {
    const rows = Array.isArray(allExpenses) ? allExpenses : [];
    const start = _startOfWeekMonday(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = new Array(7).fill(0);

    for (const e of rows) {
      const ts = e?.created_at ? new Date(e.created_at) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (ts < start || ts >= end) continue;
      const amt = Number(e?.amount || 0);
      // Map JS day (0 Sun..6 Sat) to Mon-based index
      const js = ts.getDay();
      const idx = js === 0 ? 6 : js - 1;
      totals[idx] += amt;
    }

    const avg = totals.reduce((a, b) => a + b, 0) / 7;
    const currentJsDay = new Date().getDay();
    const currentIdx = currentJsDay === 0 ? 6 : currentJsDay - 1;

    return days.map((label, i) => ({
      day: label,
      spent: Number(totals[i].toFixed(2)),
      isHigh: avg > 0 ? totals[i] > avg * 1.6 : false,
      isFuture: i > currentIdx,
    }));
  }, [allExpenses]);

  const cashflowPrediction = useMemo(() => {
    const weeklyAvg = Number(weekly.thisTotal || 0) / 7;
    return Math.round(weeklyAvg * 28); // ~4 weeks
  }, [weekly]);

  const smartAlerts = useMemo(() => {
    const alerts = [];
    if (weekly.prevTotal > 0 && weekly.pct >= 30) {
      alerts.push(`⚠️ You spent ${weekly.pct.toFixed(0)}% more than last week`);
    }
    if ((memory?.meta?.month_total_budget || 0) > 0 && (memory?.meta?.month_overspend || 0) > 0) {
      alerts.push(`⚠️ Budget almost exceeded (over by ₹${Number(memory.meta.month_overspend).toFixed(0)})`);
    }
    return alerts.slice(0, 2);
  }, [weekly, memory]);

  const askAIExplain = async (section, context) => {
    if (explaining) return;
    setExplaining(section);
    try {
      const res = await API.post("/ai/chat", { message: "Explain this", context, data: {
        page: "dashboard",
        section,
        healthScore: Number(health || 0),
        trend,
        totalCredit: Number(totalCredit || 0),
        totalDebit: Number(totalExpenses || 0),
        savings: Number(savings || 0),
        budgets: memory?.meta?.month_total_budget ? { total_budget: memory.meta.month_total_budget } : null,
      }});
      const reply = res.data?.reply || "No explanation available.";
      setAiExplainText(reply);
      setAiExplainOpen(true);
      showToast("AI explanation ready", "success", {
        onClick: () => {
          setAiExplainOpen(true);
        },
      });
    } catch {
      showToast("Could not fetch AI explanation", "error");
    } finally {
      setExplaining("");
    }
  };

  const saveIncome = async () => {
    const month = new Date().toISOString().slice(0, 7);
    const amt = Number(incomeAmount);
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

  const trendData = useMemo(() => {
    const currMonthNum = new Date().getMonth() + 1;
    return (Array.isArray(trend) ? trend : []).map((row) => {
      const m = Number(row.month);
      const expense = Number(row.total || 0);
      const inc = income?.amount ? (m === currMonthNum ? Number(income.amount) : 0) : null;
      const savingsValue = inc == null ? null : Number(inc) - Number(expense || 0);
      return { month: m, label: monthLabel(m), expense, income: inc, savings: savingsValue };
    });
  }, [trend, income]);

  const monthOptions = useMemo(
    () =>
      trendData
        .map((r) => ({ value: Number(r.month), label: r.label }))
        .filter((r) => Number.isFinite(r.value)),
    [trendData]
  );

  const selectedMonthNum = selectedMonth ?? clickedMonth ?? (monthOptions[monthOptions.length - 1]?.value || null);

  const monthExpenses = useMemo(() => {
    const m = Number(selectedMonthNum);
    if (!m || !Array.isArray(allExpenses)) return [];
    return allExpenses.filter((e) => {
      const ts = e?.created_at ? new Date(e.created_at) : null;
      if (!ts || Number.isNaN(ts.getTime())) return false;
      return ts.getMonth() + 1 === m;
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

  const filteredMonthExpenses = useMemo(() => {
    const allowed = effectiveSelectedCats;
    return monthExpenses.filter((e) => allowed.has(String(e?.category || "").trim().toLowerCase()));
  }, [monthExpenses, effectiveSelectedCats]);

  const monthTotals = useMemo(() => {
    const expenseTotal = filteredMonthExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    const year = new Date().getFullYear();
    const monthStr = selectedMonthNum ? `${year}-${String(selectedMonthNum).padStart(2, "0")}` : "";
    const inc = monthStr && incomeByMonth[monthStr] != null ? Number(incomeByMonth[monthStr] || 0) : 0;
    return {
      monthStr,
      expenseTotal,
      incomeTotal: inc,
      savings: inc - expenseTotal,
    };
  }, [filteredMonthExpenses, incomeByMonth, selectedMonthNum]);

  const titleCaseCategory = (value) =>
    String(value || "")
      .split(/[\s_-]+/g)
      .filter(Boolean)
      .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const resetChartFilters = () => {
    const m = clickedMonth ?? selectedMonthNum;
    setSelectedMonth(m);
    // Select all categories in that month by default
    const monthCats = new Set(
      allExpenses
        .filter((e) => {
          const ts = e?.created_at ? new Date(e.created_at) : null;
          if (!ts || Number.isNaN(ts.getTime())) return false;
          return ts.getMonth() + 1 === Number(m);
        })
        .map((e) => String(e?.category || "").trim().toLowerCase())
        .filter(Boolean)
    );
    setSelectedCats(monthCats);
  };

  useEffect(() => {
    if (!chartModalOpen) return;
    (async () => {
      try {
        const res = await API.get("/expenses/");
        setAllExpenses(Array.isArray(res.data) ? res.data : []);
      } catch {
        setAllExpenses([]);
      }
      try {
        const inc = await API.get("/income/");
        const map = {};
        for (const row of Array.isArray(inc.data) ? inc.data : []) {
          if (row?.month) map[String(row.month)] = Number(row.amount || 0);
        }
        setIncomeByMonth(map);
      } catch {
        setIncomeByMonth({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartModalOpen]);

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload || {};
    const incomeVal = row.income == null ? null : Number(row.income || 0);
    const expenseVal = Number(row.expense || 0);
    const savingsVal = incomeVal == null ? null : incomeVal - expenseVal;

    return (
      <div
        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-lg dark:border-white/10 dark:bg-[#171A35] dark:text-white"
        style={{ maxWidth: 260 }}
      >
        <p className="text-xs font-semibold text-gray-700 dark:text-[#C9D1E3]">Month: {label}</p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Income</span>
            <span className="text-sm font-semibold">{incomeVal == null ? "—" : formatCurrency(incomeVal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Expenses</span>
            <span className="text-sm font-semibold">{formatCurrency(expenseVal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-2 dark:border-white/10">
            <span className="text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Savings</span>
            <span className="text-sm font-semibold">
              {incomeVal == null ? "—" : formatCurrency(savingsVal)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const _extractWeeklySuggestedAction = (reply) => {
    const text = String(reply || "").replace(/\r\n/g, "\n");
    const lines = text.split("\n").map((l) => l.trim());
    let inAction = false;
    for (const ln of lines) {
      if (!ln) continue;
      if (/^Action Plan:$/i.test(ln)) {
        inAction = true;
        continue;
      }
      if (inAction && (/^(Summary|Top Issues|Spending Breakdown|Priority|Steps):/i.test(ln))) {
        inAction = false;
      }
      if (inAction && /^[-•*]\s+/.test(ln)) {
        return ln.replace(/^[-•*]\s+/, "").trim();
      }
    }
    return "";
  };

  useEffect(() => {
    const hasData = weekly.thisTotal > 0 || weekly.prevTotal > 0;
    if (!hasData) return;
    if (weeklyActionLoading || weeklyAction) return;

    (async () => {
      setWeeklyActionLoading(true);
      try {
        const res = await API.post("/ai/chat", {
          message: "Give one suggested action for this weekly spending report.",
          context: "Dashboard weekly financial report",
          data: {
            name: displayName,
            weekly: {
              spending_change_pct: Number(weekly.pct || 0),
              total_weekly_expense: Number(weekly.thisTotal || 0),
              top_category: weekly.topCategory,
              risk_level: weekly.risk,
              cashflow_prediction_month: cashflowPrediction,
              daily: weeklyBars,
            },
          },
        });
        const reply = res.data?.reply || "";
        const suggested = _extractWeeklySuggestedAction(reply) || "";
        setWeeklyAction(suggested || "Set a budget for your top category and reduce spend by ₹500 this week.");
      } catch {
        setWeeklyAction("Set a budget for your top category and reduce spend by ₹500 this week.");
      } finally {
        setWeeklyActionLoading(false);
      }
    })();
  }, [weekly, weeklyBars, cashflowPrediction, displayName, weeklyActionLoading, weeklyAction]);

  const hasIncomeState = Boolean(income?.amount && Number(income.amount) > 0);
  const hasExpensesState = totalExpenses > 0 || (Array.isArray(allExpenses) && allExpenses.length > 0);
  
  const showOnboarding = (!onboardingDismissed) && (!hasIncomeState || !hasExpensesState || !hasBudgets);

  useEffect(() => {
    if (hasIncomeState && hasExpensesState && hasBudgets && !onboardingDismissed) {
      const timer = setTimeout(() => {
        localStorage.setItem("onboarding_done", "true");
        setOnboardingDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasIncomeState, hasExpensesState, hasBudgets, onboardingDismissed]);

  const handleDismissOnboarding = () => {
    localStorage.setItem("onboarding_done", "true");
    setOnboardingDismissed(true);
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="mx-auto max-w-6xl space-y-6 overflow-x-hidden">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Financial Report</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9AA3B2]">A quick check-in for the last 7 days.</p>
          </div>
          {smartAlerts.length ? (
            <div className="space-y-1 text-right">
              {smartAlerts.map((a, i) => (
                <p key={i} className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                  {a}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#1E2247]">
            <p className="text-xs font-medium text-gray-700 dark:text-[#C9D1E3]">Change vs last week</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">
              {weekly.prevTotal > 0 ? `${weekly.pct >= 0 ? "+" : ""}${weekly.pct.toFixed(0)}%` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#1E2247]">
            <p className="text-xs font-medium text-gray-700 dark:text-[#C9D1E3]">Weekly expense</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">
              {weekly.thisTotal > 0 ? formatCurrency(weekly.thisTotal) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#1E2247]">
            <p className="text-xs font-medium text-gray-700 dark:text-[#C9D1E3]">Top category</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
              {weekly.topCategory ? String(weekly.topCategory) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#1E2247]">
            <p className="text-xs font-medium text-gray-700 dark:text-[#C9D1E3]">Risk level</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{weekly.risk}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#1E2247]">
            <p className="text-xs font-medium text-gray-700 dark:text-[#C9D1E3]">Suggested action</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-900 dark:text-white">
              {weeklyActionLoading ? "Generating..." : weeklyAction || "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#1E2247]">
          <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">This week (Mon–Sun)</p>
          {weeklyBars.every((d) => (d.spent || 0) === 0) ? (
            <p className="text-sm text-gray-700 dark:text-[#C9D1E3]">No spending recorded this week yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBars} margin={{ top: 16, right: 10, left: 0, bottom: 0 }} barCategoryGap={12}>
                  <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${Number(v || 0).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v) => [formatCurrency(v), "Spent"]}
                    labelFormatter={(label) => `Day: ${label}`}
                  />
                  <Bar dataKey="spent" name="Spent" radius={[10, 10, 0, 0]} isAnimationActive animationDuration={800}>
                    {weeklyBars.map((entry, idx) => (
                      <Cell key={idx} fill={entry.isHigh && !entry.isFuture ? "#ef4444" : "#3b82f6"} fillOpacity={entry.isFuture ? 0.3 : 1} />
                    ))}
                    <LabelList
                      dataKey="spent"
                      position="top"
                      formatter={(v) => (v ? `₹${Number(v).toFixed(0)}` : "")}
                      style={{ fontSize: 11, fill: isDark ? "#C9D1E3" : "#374151", fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-gray-700 dark:text-[#C9D1E3]">
          At this rate, you will spend <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(cashflowPrediction)}</span> this month.
        </p>
      </div>

      {showOnboarding ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-glow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome to ExpenseAI 🎉</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-app-muted">Let's get your workspace set up in 3 easy steps.</p>
            </div>
            <button
               onClick={handleDismissOnboarding}
               className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-app-muted dark:hover:text-white"
            >
              Dismiss
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
             <div
               role={hasIncomeState ? "presentation" : "button"}
               tabIndex={hasIncomeState ? -1 : 0}
               onClick={() => !hasIncomeState && setIncomeModal(true)}
               className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                 hasIncomeState
                   ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10 cursor-default"
                   : "border-gray-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-app-card dark:hover:border-blue-500/50 cursor-pointer shadow-sm hover:shadow-md"
               }`}
             >
               <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${hasIncomeState ? "bg-emerald-500 text-white" : "border-2 border-gray-300 dark:border-gray-600"}`}>
                 {hasIncomeState && <Check className="h-4 w-4" strokeWidth={3} />}
               </div>
               <div>
                 <h3 className={`text-sm font-semibold ${hasIncomeState ? "text-emerald-900 dark:text-emerald-300" : "text-gray-900 dark:text-white"}`}>Add your income</h3>
                 <p className={`mt-0.5 text-xs ${hasIncomeState ? "text-emerald-700 dark:text-emerald-400/80" : "text-gray-500 dark:text-app-muted"}`}>Set a baseline for month</p>
               </div>
             </div>
             
             <div
               role={hasExpensesState ? "presentation" : "button"}
               tabIndex={hasExpensesState ? -1 : 0}
               onClick={() => !hasExpensesState && navigate('/expenses')}
               className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                 hasExpensesState
                   ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10 cursor-default"
                   : "border-gray-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-app-card dark:hover:border-blue-500/50 cursor-pointer shadow-sm hover:shadow-md"
               }`}
             >
               <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${hasExpensesState ? "bg-emerald-500 text-white" : "border-2 border-gray-300 dark:border-gray-600"}`}>
                 {hasExpensesState && <Check className="h-4 w-4" strokeWidth={3} />}
               </div>
               <div>
                 <h3 className={`text-sm font-semibold ${hasExpensesState ? "text-emerald-900 dark:text-emerald-300" : "text-gray-900 dark:text-white"}`}>Add an expense</h3>
                 <p className={`mt-0.5 text-xs ${hasExpensesState ? "text-emerald-700 dark:text-emerald-400/80" : "text-gray-500 dark:text-app-muted"}`}>Record a transaction</p>
               </div>
             </div>

             <div
               role={hasBudgets ? "presentation" : "button"}
               tabIndex={hasBudgets ? -1 : 0}
               onClick={() => !hasBudgets && navigate('/budgets')}
               className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                 hasBudgets
                   ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10 cursor-default"
                   : "border-gray-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-app-card dark:hover:border-blue-500/50 cursor-pointer shadow-sm hover:shadow-md"
               }`}
             >
               <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${hasBudgets ? "bg-emerald-500 text-white" : "border-2 border-gray-300 dark:border-gray-600"}`}>
                 {hasBudgets && <Check className="h-4 w-4" strokeWidth={3} />}
               </div>
               <div>
                 <h3 className={`text-sm font-semibold ${hasBudgets ? "text-emerald-900 dark:text-emerald-300" : "text-gray-900 dark:text-white"}`}>Create a budget</h3>
                 <p className={`mt-0.5 text-xs ${hasBudgets ? "text-emerald-700 dark:text-emerald-400/80" : "text-gray-500 dark:text-app-muted"}`}>Set category limits</p>
               </div>
             </div>
          </div>
        </div>
      ) : (!income?.amount && totalExpenses === 0) ? (
        <EmptyState 
           icon={Wallet} 
           title="Welcome to Expense AI!" 
           description="Add your first income or expense to get started. You can track spending, create budgets, and gain smart insights." 
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
            <p className="text-sm text-gray-500 dark:text-[#9AA3B2]">Income</p>
            {income?.amount ? (
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totalCredit)}</p>
            ) : (
              <button
                type="button"
                onClick={() => setIncomeModal(true)}
                className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Add income
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
            <p className="text-sm text-gray-500 dark:text-[#9AA3B2]">Expenses</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
            <p className="text-sm text-gray-500 dark:text-[#9AA3B2]">Savings</p>
            <p className={`mt-2 text-2xl font-semibold ${savings < 0 ? "text-red-500" : "text-emerald-500"}`}>
              {income?.amount ? formatCurrency(savings) : "—"}
            </p>
            {!income?.amount ? (
              <p className="mt-2 text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Add income to calculate savings.</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly trend</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9AA3B2]">Income vs expenses by month.</p>
          </div>
          <button
            type="button"
            onClick={() => askAIExplain("monthly_trend", "Dashboard: monthly trend bar chart (income vs expenses).")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1E2247] dark:text-[#C9D1E3] dark:hover:bg-white/5"
          >
            {explaining === "monthly_trend" ? "Explaining..." : "Explain this"}
          </button>
        </div>

        {trendData.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-white/15 dark:bg-white/[0.04]">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">No data yet</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9AA3B2]">Add expenses to see your monthly trend.</p>
            <button
              type="button"
              onClick={() => navigate("/expenses")}
              className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Add Expense
            </button>
          </div>
        ) : (
          <div className="h-80 bg-white dark:bg-transparent">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData}
                margin={{ top: 16, right: 10, left: 0, bottom: 0 }}
                barCategoryGap={14}
                onMouseMove={(state) => {
                  if (state?.isTooltipActive) setHoveredMonthLabel(String(state.activeLabel || ""));
                }}
                onMouseLeave={() => setHoveredMonthLabel("")}
              >
                <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${Number(v || 0).toFixed(0)}`}
                />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={legendStyle} />
                {income?.amount ? (
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#3b82f6"
                    onClick={(dataPoint) => {
                      const m = Number(dataPoint?.month);
                      if (!m) return;
                      setClickedMonth(m);
                      setSelectedMonth(m);
                      setChartModalOpen(true);
                      setSelectedCats(new Set());
                    }}
                    radius={[10, 10, 0, 0]}
                    isAnimationActive
                    animationDuration={800}
                    activeBar={(props) => <Rectangle {...props} fillOpacity={0.95} stroke="#60a5fa" strokeWidth={1} />}
                    shape={(props) => (
                      <Rectangle {...props} fillOpacity={hoveredMonthLabel && props?.payload?.label === hoveredMonthLabel ? 0.95 : 0.85} />
                    )}
                  >
                    <LabelList
                      dataKey="income"
                      position="top"
                      formatter={(v) => (v ? `₹${Number(v).toFixed(0)}` : "")}
                      style={{ fontSize: 11, fill: isDark ? "#C9D1E3" : "#374151", fontWeight: 600 }}
                    />
                  </Bar>
                ) : null}
                <Bar
                  dataKey="expense"
                  name="Expense"
                  fill="#ef4444"
                  onClick={(dataPoint) => {
                    const m = Number(dataPoint?.month);
                    if (!m) return;
                    setClickedMonth(m);
                    setSelectedMonth(m);
                    setChartModalOpen(true);
                    setSelectedCats(new Set());
                  }}
                  radius={[10, 10, 0, 0]}
                  isAnimationActive
                  animationDuration={800}
                  activeBar={(props) => <Rectangle {...props} fillOpacity={0.95} stroke="#fca5a5" strokeWidth={1} />}
                  shape={(props) => (
                    <Rectangle {...props} fillOpacity={hoveredMonthLabel && props?.payload?.label === hoveredMonthLabel ? 0.95 : 0.85} />
                  )}
                >
                  <LabelList
                    dataKey="expense"
                    position="top"
                    formatter={(v) => (v ? `₹${Number(v).toFixed(0)}` : "")}
                    style={{ fontSize: 11, fill: isDark ? "#C9D1E3" : "#374151", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#171A35]">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Alerts</h3>
          <button
            type="button"
            onClick={() => navigate("/analytics")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1E2247] dark:text-[#C9D1E3] dark:hover:bg-white/5"
          >
            View details
          </button>
        </div>
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                a.tone === "red"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/25 dark:bg-red-500/15 dark:text-red-200"
                  : "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-400/25 dark:bg-yellow-500/15 dark:text-yellow-100"
              }`}
            >
              ⚠️ {a.text}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <AnomalyAlerts />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col gap-6">
          <BehaviorCard />
          <WhatIfSimulator 
            income={Number(income?.amount || 0)} 
            expense={totalExpenses} 
          />
        </div>
        <div>
          <SpendingForecast />
        </div>
      </div>

      {incomeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setIncomeModal(false)} aria-label="Close income modal" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#171A35]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add monthly income</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9AA3B2]">Used to calculate savings and health score.</p>
            <input
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 85000"
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-[#1E2247] dark:text-white"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setIncomeModal(false)} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                Cancel
              </button>
              <button onClick={saveIncome} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        title="Monthly details"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                resetChartFilters();
              }}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setChartModalOpen(false)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Done
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-[#9AA3B2]">Month</label>
              <select
                value={selectedMonthNum || ""}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSelectedMonth(m);
                  // When month changes, default select all categories for that month
                  setSelectedCats(new Set());
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-[#1E2247] dark:text-white"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 dark:border-white/10 dark:bg-[#1E2247] dark:text-white">
              <div className="flex items-center justify-between gap-6">
                <span className="text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Income</span>
                <span className="font-semibold tabular-nums">{monthTotals.monthStr ? formatCurrency(monthTotals.incomeTotal) : "—"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-6">
                <span className="text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Expense</span>
                <span className="font-semibold tabular-nums">{formatCurrency(monthTotals.expenseTotal)}</span>
              </div>
              <div className="mt-2 border-t border-gray-200 pt-2 dark:border-white/10">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">Savings</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(monthTotals.savings)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-[#9AA3B2]">Categories</p>
            {categoriesInMonth.length === 0 ? (
              <p className="text-sm text-gray-700 dark:text-[#C9D1E3]">No expenses for this month.</p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#1E2247]">
                {categoriesInMonth.map((cat) => {
                  const checked = effectiveSelectedCats.has(cat);
                  return (
                    <label key={cat} className="flex items-center justify-between gap-3 text-sm text-gray-900 dark:text-white">
                      <span className="flex-1">{titleCaseCategory(cat)}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(effectiveSelectedCats);
                          if (e.target.checked) next.add(cat);
                          else next.delete(cat);
                          setSelectedCats(next);
                        }}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs font-medium text-gray-600 dark:text-[#9AA3B2]">
              Values update instantly based on your filters.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={aiExplainOpen}
        onClose={() => setAiExplainOpen(false)}
        title="AI Explanation"
        footer={
          <button
            type="button"
            onClick={() => setAiExplainOpen(false)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Close
          </button>
        }
      >
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-900 dark:border-white/10 dark:bg-[#1E2247] dark:text-[#C9D1E3]">
          <pre className="whitespace-pre-wrap font-sans">
            {aiExplainText || "No explanation available."}
          </pre>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
