import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Wallet, Check } from "lucide-react";
import {
  getHealthScore,
  getMonthlyTrend,
  getCategoryData,
  getRecentExpenses,
} from "../api/dashboard";
import { getBudgetVsActual } from "../api/budgets";
import API from "../api/axios";
import { formatCurrency as globalFormatCurrency } from "../utils/currency";
import { useToast } from "../components/ToastProvider";
import { getUserDisplayName } from "../utils/auth";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { monthLabel, currentMonthParam } from "../utils/month";
import WhatIfSimulator from "../components/WhatIfSimulator";
import AnomalyAlerts from "../components/AnomalyAlerts";
import HeroBanner from "../components/dashboard/HeroBanner";
import WeeklyReport from "../components/dashboard/WeeklyReport";
import KPICards from "../components/dashboard/KPICards";
import SmartAlerts from "../components/dashboard/SmartAlerts";
import UpcomingSubscriptions from "../components/dashboard/UpcomingSubscriptions";
import EMIOverview from "../components/dashboard/EMIOverview";
import OnboardingWizard, { ONBOARDING_PROGRESS_KEY } from "../components/OnboardingWizard";

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, currency, currencySymbol } = useTheme();
  const { showToast } = useToast();

  const [health,               setHealth]               = useState(0);
  const [healthDetail,         setHealthDetail]         = useState(null);
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
  const [incomeRecurring,      setIncomeRecurring]      = useState(false);
  const [incomeFrequency,      setIncomeFrequency]      = useState("monthly");
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
  const [budgetVsActual,       setBudgetVsActual]       = useState(null);
  const [totalMonthlyEMI,      setTotalMonthlyEMI]      = useState(0);
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
        setHealthDetail(h);
      } catch (err) { console.error(err); }

      try {
        const [t, c, e, bdg, bva, emiSummaryRes] = await Promise.all([
          getMonthlyTrend(),
          getCategoryData(currentMonthParam()),
          getRecentExpenses(),
          API.get("/budgets/"),
          getBudgetVsActual(currentMonthParam()).catch(() => null),
          API.get("/emi/summary").catch(() => null),
        ]);
        setTrend(t);
        setCategory(c);
        setExpenses(e);
        setHasBudgets(Array.isArray(bdg.data) && bdg.data.length > 0);
        setBudgetVsActual(bva);
        setTotalMonthlyEMI(Number(emiSummaryRes?.data?.total_monthly_emi || 0));
      } catch (err) { console.error(err); }

      try {
        const [expRes, incRes] = await Promise.all([
          API.get("/expenses/"),
          API.get("/income/"),
        ]);
        setAllExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        const map = {};
        for (const row of Array.isArray(incRes.data) ? incRes.data : []) {
          if (row?.month) {
            map[String(row.month)] = { amount: Number(row.amount || 0), isRecurring: Boolean(row.is_recurring) };
          }
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

  // The single most over-budget category this month (if any budgets are
  // set), used to make budget alerts specific instead of a bare total.
  const topOverBudgetCategory = useMemo(() => {
    const cats = Array.isArray(budgetVsActual?.categories) ? budgetVsActual.categories : [];
    const overBudget = cats
      .map((c) => ({ ...c, overage: Number(c.actual_spent || 0) - Number(c.budget || 0) }))
      .filter((c) => c.overage > 0)
      .sort((a, b) => b.overage - a.overage);
    return overBudget[0] || null;
  }, [budgetVsActual]);

  const currentMonthLabel = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  const budgetAlertText = (overspendAmount) => {
    if (topOverBudgetCategory) {
      const raw = String(topOverBudgetCategory.category || "");
      const catName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return `${catName} budget exceeded for ${currentMonthLabel} — ${formatCurrency(topOverBudgetCategory.actual_spent)} spent vs ${formatCurrency(topOverBudgetCategory.budget)} limit`;
    }
    return `Budget exceeded for ${currentMonthLabel} (over by ${formatCurrency(overspendAmount)})`;
  };

  // ── Alert banners (Smart Alerts section) ───────────────────
  const alerts = useMemo(() => {
    const a = [];
    if (health < 50) a.push({ tone: "yellow", text: "Your financial health score is below target." });
    if (income?.amount && totalExpenses > totalCredit)
      a.push({ tone: "red", text: "You exceeded your recorded monthly income." });
    if ((memory?.meta?.month_total_budget || 0) > 0 && (memory?.meta?.month_overspend || 0) > 0) {
      a.push({
        tone: "red",
        text: budgetAlertText(memory.meta.month_overspend),
      });
    }
    return a.length
      ? a.slice(0, 3)
      : [{ tone: "yellow", text: "Spending is stable. Keep monitoring weekly variance." }];
  }, [health, income, totalExpenses, totalCredit, memory, currencySymbol, topOverBudgetCategory]);

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
    // Use the same Mon–Sun calendar week as the bar chart so "Weekly Expense" == bar total.
    const weekStart = _startOfWeekMonday(new Date());
    const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate() - 7);

    const rows = Array.isArray(allExpenses) && allExpenses.length
      ? allExpenses
      : Array.isArray(expenses) ? expenses : [];

    let thisTotal = 0;
    let prevTotal = 0;
    const catTotals = new Map();

    for (const e of rows) {
      const amt = Number(e.amount || 0);
      // Prefer actual transaction date; fall back to created_at for manually-added expenses
      const txDate = e.date ? new Date(e.date) : e.created_at ? new Date(e.created_at) : null;
      if (!txDate || !Number.isFinite(txDate.getTime())) continue;
      const t = txDate.getTime();
      if (t >= weekStart.getTime() && t < weekEnd.getTime()) {
        thisTotal += amt;
        const c = String(e.category || "Other");
        catTotals.set(c, (catTotals.get(c) || 0) + amt);
      } else if (t >= prevStart.getTime() && t < weekStart.getTime()) {
        prevTotal += amt;
      }
    }

    // "Other" as the #1 category tells the user nothing useful — prefer the
    // top category that's actually identifiable, falling back to a clearer
    // "Uncategorized" label only when every dollar this week was "other".
    const titleCase = (s) => {
      const str = String(s || "");
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };
    const rankedCats = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]);
    let topCategory = null;
    if (rankedCats.length > 0) {
      const [firstCat] = rankedCats[0];
      if (String(firstCat).toLowerCase() === "other") {
        const nextNonOther = rankedCats.find(([c]) => String(c).toLowerCase() !== "other");
        topCategory = nextNonOther ? titleCase(nextNonOther[0]) : "Uncategorized";
      } else {
        topCategory = titleCase(firstCat);
      }
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
    const end   = new Date(start); end.setDate(end.getDate() + 7);

    const days   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = new Array(7).fill(0);

    for (const e of rows) {
      // Prefer actual transaction date; fall back to created_at for manually-added expenses
      const ts = e?.date ? new Date(e.date) : e?.created_at ? new Date(e.created_at) : null;
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

  // null = not enough days elapsed yet for a meaningful projection (distinct
  // from 0, which means "genuinely no spending this month so far").
  const cashflowPrediction = useMemo(() => {
    const today = new Date();
    const daysElapsed = today.getDate();
    if (daysElapsed < 5) return null;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    // Use local month/year (toISOString gives UTC which can be the previous day near midnight in IST)
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    // Use actual transaction date for month bucketing so imported historical data
    // (e.g. May expenses imported in June) doesn't inflate the June projection.
    // Fall back to created_at for manually-added expenses that have no transaction date.
    const monthTotal = (Array.isArray(allExpenses) ? allExpenses : [])
      .filter((e) => {
        const ts = e?.date ? new Date(e.date) : e?.created_at ? new Date(e.created_at) : null;
        return ts && ts.getMonth() === currentMonth && ts.getFullYear() === currentYear;
      })
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    if (monthTotal === 0) return 0;
    const projection = Math.round((monthTotal / daysElapsed) * daysInMonth);
    // Projection can never be less than what's already been spent
    return Math.max(projection, Math.round(monthTotal));
  }, [allExpenses]);

  const smartAlerts = useMemo(() => {
    const a = [];
    if (weekly.prevTotal > 0 && weekly.pct >= 30)
      a.push(`You spent ${Math.round(weekly.pct)}% more than last week`);
    if ((memory?.meta?.month_total_budget || 0) > 0 && (memory?.meta?.month_overspend || 0) > 0)
      a.push(budgetAlertText(memory.meta.month_overspend));
    return a.slice(0, 2);
  }, [weekly, memory, topOverBudgetCategory]);

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
      const res = await API.post("/income/", {
        month,
        amount: amt,
        is_recurring: incomeRecurring,
        recurring_frequency: incomeRecurring ? incomeFrequency : null,
      });
      setIncome(res.data || null);
      // Keep the month drill-down table's income figure in sync — it reads
      // from incomeByMonth, which otherwise only refreshes when that modal
      // is (re)opened, not immediately after this save.
      setIncomeByMonth((prev) => ({ ...prev, [month]: { amount: amt, isRecurring: incomeRecurring } }));
      showToast("Income saved", "success");
      // Show one toast per auto-save rule that was applied
      const autoSaves = res.data?.auto_saves ?? [];
      autoSaves.forEach((s) => {
        showToast(
          `₹${Number(s.amount).toLocaleString("en-IN")} auto-saved toward ${s.goal_name}`,
          "success"
        );
      });
      setIncomeModal(false);
      setIncomeAmount("");
      setIncomeRecurring(false);
      setIncomeFrequency("monthly");
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
      const ts = e?.date ? new Date(e.date) : e?.created_at ? new Date(e.created_at) : null;
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
    const monthIncome  = monthStr ? incomeByMonth[monthStr] : null;
    const inc          = monthIncome != null ? Number(monthIncome.amount || 0) : 0;
    return {
      monthStr,
      expenseTotal,
      incomeTotal: inc,
      incomeIsRecurring: Boolean(monthIncome?.isRecurring),
      savings: inc - expenseTotal,
    };
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
          const ts = e?.date ? new Date(e.date) : e?.created_at ? new Date(e.created_at) : null;
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
          if (row?.month) {
            map[String(row.month)] = { amount: Number(row.amount || 0), isRecurring: Boolean(row.is_recurring) };
          }
        }
        setIncomeByMonth(map);
      } catch { setIncomeByMonth({}); }
    })();
  }, [chartModalOpen]);

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
  useEffect(() => {
    const hasData = weekly.thisTotal > 0 || weekly.prevTotal > 0;
    if (!hasData || weeklyActionLoading || weeklyAction) return;

    const CACHE_KEY = "finpulse_weekly_action";
    const CACHE_TTL = 60 * 60 * 1000;

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

  // Brand new = zero expenses AND zero income, ever — not just this month.
  // Replaces the whole Dashboard (not the lighter "Welcome to FinPulse"
  // checklist below, which still applies once they have *some* data but are
  // missing a piece — e.g. expenses imported but no budget yet).
  const isBrandNewUser = allExpenses.length === 0 && Object.keys(incomeByMonth).length === 0;
  const wizardDismissed = (() => {
    try {
      return JSON.parse(localStorage.getItem(ONBOARDING_PROGRESS_KEY))?.dismissed === true;
    } catch {
      return false;
    }
  })();
  if (isBrandNewUser && !wizardDismissed) {
    return <OnboardingWizard onComplete={() => window.location.reload()} />;
  }

  // ── Shared helpers ──────────────────────────────────────────
  const btnPrimary   = "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 active:scale-[0.99]";
  const btnSecondary = "rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-muted dark:hover:bg-white/5";

  // ── Framer Motion row animation ─────────────────────────────
  const row = (delay) => ({
    initial:    { opacity: 0, y: 16 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">

      {/* Row 1 — Hero banner (full width) */}
      <motion.div {...row(0)} className="mb-4">
        <HeroBanner
          displayName={displayName}
          health={health}
          healthDetail={healthDetail}
          cashflowPrediction={cashflowPrediction}
          formatCurrency={formatCurrency}
          income={totalCredit}
          totalExpenses={totalExpenses}
          totalBudget={memory?.meta?.month_total_budget || 0}
          totalMonthlyEMI={totalMonthlyEMI}
        />
      </motion.div>

      {/* Row 2 — Onboarding / empty state / KPI cards */}
      <motion.div {...row(0.1)}>
        {showOnboarding ? (
          <div className="rounded-2xl border border-cyan-200/60 bg-cyan-50/30 p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-app-ink">
                  Welcome to FinPulse
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-app-muted">
                  Set up your workspace in 3 steps.
                </p>
              </div>
              <button onClick={handleDismissOnboarding}
                className="text-xs font-medium text-gray-400 hover:text-gray-700 dark:text-app-muted dark:hover:text-app-ink">
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
                    <p className={`text-sm font-semibold ${done ? "text-emerald-800 dark:text-emerald-300" : "text-gray-900 dark:text-app-ink"}`}>
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
          <KPICards
            income={income}
            totalCredit={totalCredit}
            totalExpenses={totalExpenses}
            savings={savings}
            weekly={weekly}
            formatCurrency={formatCurrency}
            btnPrimary={btnPrimary}
            setIncomeModal={setIncomeModal}
            topOverBudgetCategory={topOverBudgetCategory}
            navigate={navigate}
            totalMonthlyEMI={totalMonthlyEMI}
          />
        )}
      </motion.div>

      {/* Row 3 — 60/40: WeeklyReport | SmartAlerts + AnomalyAlerts */}
      <motion.div {...row(0.2)}>
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="col-span-3 flex flex-col">
            <WeeklyReport
              weekly={weekly}
              weeklyBars={weeklyBars}
              weeklyAction={weeklyAction}
              weeklyActionLoading={weeklyActionLoading}
              cashflowPrediction={cashflowPrediction}
              smartAlerts={smartAlerts}
              formatCurrency={formatCurrency}
              isDark={isDark}
              chartTooltipStyle={chartTooltipStyle}
              chartAxisTick={chartAxisTick}
              chartGrid={chartGrid}
              className="flex-1"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-4">
            <SmartAlerts
              alerts={alerts}
              btnSecondary={btnSecondary}
              navigate={navigate}
            />
            <AnomalyAlerts />
            <UpcomingSubscriptions />
            <EMIOverview />
          </div>
        </div>
      </motion.div>

      {/* Row 5 — Scenario Tools */}
      <motion.div {...row(0.4)}>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted mb-2">
          Scenario Tools
        </p>
        <div className="grid grid-cols-1 gap-4 mb-4">
          <WhatIfSimulator income={Number(income?.amount || 0)} expense={totalExpenses} />
        </div>
      </motion.div>

      {/* ── Income modal ──────────────────────────────────── */}
      {incomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40 dark:bg-black/60"
            onClick={() => setIncomeModal(false)} aria-label="Close income modal" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-white/[0.08] dark:bg-app-card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-app-ink">Add monthly income</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">Used to calculate savings and health score.</p>
            <input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)}
              type="number" min="0" step="1" placeholder="e.g. 85000"
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-ink"
            />

            <label className="mt-4 flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={incomeRecurring}
                onChange={(e) => setIncomeRecurring(e.target.checked)}
                className="h-4 w-4 accent-cyan-500"
              />
              <span className="text-sm text-gray-700 dark:text-app-subtle">This repeats every month</span>
            </label>

            {incomeRecurring && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-app-muted">Frequency</label>
                <select
                  value={incomeFrequency}
                  onChange={(e) => setIncomeFrequency(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-500 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-ink"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-400 dark:text-app-muted">
                  We'll automatically fill in this amount for future months until you change it.
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => {
                setIncomeModal(false);
                setIncomeRecurring(false);
                setIncomeFrequency("monthly");
              }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-muted dark:hover:bg-white/5">
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
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-ink dark:hover:bg-white/5">
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
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-500 dark:border-white/[0.08] dark:bg-app-surface dark:text-app-ink"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-app-card">
              {[
                ["Income",  monthTotals.monthStr ? formatCurrency(monthTotals.incomeTotal) : "—", monthTotals.incomeIsRecurring],
                ["Expense", formatCurrency(monthTotals.expenseTotal), false],
                ["Savings", formatCurrency(monthTotals.savings), false],
              ].map(([label, val, isRecurring]) => (
                <div key={label} className="flex justify-between gap-6">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-app-muted">
                    {label}
                    {isRecurring && (
                      <span className="rounded-full bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                        Recurring
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-app-ink">{val}</span>
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
                  <label key={cat} className="flex items-center justify-between gap-3 text-sm text-gray-900 dark:text-app-ink">
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
