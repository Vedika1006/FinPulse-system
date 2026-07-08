import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getBudgets,
  createBudget,
  getBudgetVsActual,
  deleteBudget,
  getBudgetSuggestions,
  updateBudgetRollover,
} from "../api/budgets";
import { getAutoSaveRules, createAutoSaveRule, deleteAutoSaveRule } from "../api/autoSaveRules";
import { getGoals, createGoal, deleteGoal, updateGoal } from "../api/goals";
import { getHealthScore } from "../api/dashboard";
import { currentMonthParam } from "../utils/month";
import { formatCurrency as globalFormatCurrency } from "../utils/currency";
import { useTheme } from "../context/ThemeContext";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { CardSkeleton } from "../components/ui/Skeleton";
import { ProgressBar, budgetUsageTone } from "../components/ui/ProgressBar";
import { AlertBanner } from "../components/ui/AlertBanner";
import { useToast } from "../components/ToastProvider";
import API from "../api/axios";
import { CATEGORIES, getCategoryMeta } from "../constants/categories";
import FormattedAIResponse from "../components/FormattedAIResponse";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Wallet, CheckCircle2, Sparkles } from "lucide-react";

function pctUsed(spent, budget) {
  const b = Number(budget);
  const s = Number(spent);
  if (!b || b <= 0) return 0;
  return (s / b) * 100;
}

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:placeholder:text-app-muted dark:focus:border-cyan-500/40";

export default function Budgets() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currency } = useTheme();
  const formatINR = (v) => globalFormatCurrency(v, currency);

  const [month,        setMonth]        = useState(currentMonthParam);
  const [vs,           setVs]           = useState(null);
  const [allBudgets,   setAllBudgets]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [goalModalOpen,setGoalModalOpen]= useState(false);
  const [saving,       setSaving]       = useState(false);
  const [goals,        setGoals]        = useState([]);
  const [incomeByMonth,setIncomeByMonth]= useState({});
  const [explaining,   setExplaining]   = useState(false);
  const [aiExplanation,setAiExplanation]= useState("");
  const explanationRef = useState(() => ({ current: null }))[0];
  const [highlightExplanation, setHighlightExplanation] = useState(false);
  const [deleteBudgetId, setDeleteBudgetId] = useState(null);

  // ── Add Funds modal state ───────────────────────────────
  // Replaces window.prompt() — a browser native popup that
  // breaks the product feel and can't be styled or dismissed
  // cleanly.
  const [addFundsModal,   setAddFundsModal]   = useState(false);
  const [addFundsGoal,    setAddFundsGoal]    = useState(null);
  const [addFundsAmount,  setAddFundsAmount]  = useState("");
  const [addFundsSaving,  setAddFundsSaving]  = useState(false);

  const [form, setForm]         = useState({ category: "", amount: "" });
  const [goalForm, setGoalForm] = useState({ name: "", target_amount: "", deadline: "" });

  // ── AI Suggested Budgets tab ────────────────────────────
  const [budgetTab,           setBudgetTab]           = useState("my-budgets");
  const [suggestions,         setSuggestions]         = useState([]);
  const [suggestionsLoading,  setSuggestionsLoading]  = useState(false);
  const [suggestEditAmounts,  setSuggestEditAmounts]  = useState({});
  const [acceptingSuggestion, setAcceptingSuggestion] = useState(null);

  // ── Budget Rules tab ────────────────────────────────────
  const [togglingRollover,  setTogglingRollover]  = useState(null); // budget id
  const [autoSaveRules,     setAutoSaveRules]     = useState([]);
  const [autoSaveLoading,   setAutoSaveLoading]   = useState(false);
  const [autoSaveForm,      setAutoSaveForm]      = useState({ goal_id: "", type: "fixed", value: "" });
  const [savingAutoRule,    setSavingAutoRule]     = useState(false);
  const [deletingRuleId,    setDeletingRuleId]    = useState(null);

  const titleCaseCategory = (value) =>
    String(value || "").split(/[\s_-]+/g).filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  // Deep-link: /budgets?category=Food&month=YYYY-MM
  useEffect(() => {
    const cat = searchParams.get("category");
    const m   = searchParams.get("month");
    if (m && typeof m === "string" && m !== month) setMonth(m);
    if (cat && typeof cat === "string") {
      setForm((f) => ({ ...f, category: getCategoryMeta(cat).value }));
      setModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("category");
      next.delete("month");
      setSearchParams(next, { replace: true });
    }
  }, []); // eslint-disable-line

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [vsData, list, incomeList, goalsList] = await Promise.all([
        getBudgetVsActual(month),
        getBudgets(),
        API.get("/income/"),
        getGoals(),
      ]);
      setVs(vsData);
      setAllBudgets(Array.isArray(list) ? list : []);
      setGoals(Array.isArray(goalsList) ? goalsList : []);
      const incMap = {};
      for (const row of Array.isArray(incomeList?.data) ? incomeList.data : []) {
        if (row?.month) incMap[String(row.month)] = Number(row.amount || 0);
      }
      setIncomeByMonth(incMap);
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.detail || e.message || "Failed to load data";
      setError(typeof msg === "string" ? msg : "Failed to load data");
      setVs(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    if (!vs || !Array.isArray(vs.categories)) return [];
    return vs.categories.map((c) => ({
      ...c,
      budget:       Number(c.budget),
      actual_spent: Number(c.actual_spent),
      remaining:    Number(c.remaining),
      pct:          pctUsed(c.actual_spent, c.budget),
    }));
  }, [vs]);

  const monthBudgetRows = useMemo(
    () => allBudgets.filter((b) => b.month === month),
    [allBudgets, month]
  );

  // ── Goal handlers ───────────────────────────────────────
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    const amount = parseFloat(goalForm.target_amount, 10);
    if (!goalForm.name.trim() || Number.isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await createGoal({ name: goalForm.name.trim(), target_amount: amount, deadline: goalForm.deadline || undefined });
      setGoalForm({ name: "", target_amount: "", deadline: "" });
      setGoalModalOpen(false);
      showToast("Goal created", "success");
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || "Could not create goal";
      showToast(typeof msg === "string" ? msg : "Could not create goal", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (id) => {
    try {
      await deleteGoal(id);
      showToast("Goal removed", "success");
      await load();
    } catch {
      showToast("Could not delete goal", "error");
    }
  };

  // Opens the Add Funds modal instead of window.prompt()
  const handleAddFunds = (g) => {
    setAddFundsGoal(g);
    setAddFundsAmount("");
    setAddFundsModal(true);
  };

  // Called when user confirms the Add Funds modal
  const confirmAddFunds = async () => {
    const amount = parseFloat(addFundsAmount);
    if (!addFundsGoal || Number.isNaN(amount) || amount <= 0) return;
    setAddFundsSaving(true);
    try {
      await updateGoal(addFundsGoal.id, {
        saved_amount: addFundsGoal.saved_amount + amount,
      });
      showToast("Funds added to goal!", "success");
      setAddFundsModal(false);
      setAddFundsGoal(null);
      setAddFundsAmount("");
      await load();
    } catch {
      showToast("Could not add funds to goal", "error");
    } finally {
      setAddFundsSaving(false);
    }
  };

  // ── Budget handlers ─────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount, 10);
    if (!form.category.trim() || Number.isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await createBudget({ category: form.category.trim(), amount, month });
      setForm({ category: "", amount: "" });
      setModalOpen(false);
      showToast("Budget created", "success");
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || "Could not create budget";
      showToast(typeof msg === "string" ? msg : "Could not create budget", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => setDeleteBudgetId(id);
  const confirmDelete = async () => {
    if (!deleteBudgetId) return;
    try {
      // deleteBudget is now correctly imported — previously caused
      // a ReferenceError crash on every delete attempt
      await deleteBudget(deleteBudgetId);
      showToast("Budget removed", "success");
      setDeleteBudgetId(null);
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || "Could not delete";
      showToast(typeof msg === "string" ? msg : "Could not delete", "error");
    }
  };

  useEffect(() => {
    if (budgetTab !== "ai-suggested") return;
    setSuggestionsLoading(true);
    getBudgetSuggestions()
      .then((data) => {
        setSuggestions(data);
        const init = {};
        data.forEach((s) => { init[s.category] = String(s.suggested_budget); });
        setSuggestEditAmounts(init);
      })
      .catch(() => showToast("Could not load AI suggestions", "error"))
      .finally(() => setSuggestionsLoading(false));
  }, [budgetTab]); // eslint-disable-line

  const handleAcceptSuggestion = async (cat) => {
    const amount = parseFloat(suggestEditAmounts[cat]);
    if (Number.isNaN(amount) || amount <= 0) return;
    setAcceptingSuggestion(cat);
    try {
      await createBudget({ category: cat, amount, month });
      showToast(`Budget set for ${titleCaseCategory(cat)}`, "success");
      setSuggestions((prev) => prev.filter((s) => s.category !== cat));
      await load();
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not create budget";
      showToast(typeof msg === "string" ? msg : "Could not create budget", "error");
    } finally {
      setAcceptingSuggestion(null);
    }
  };

  // Previous month label for rollover note ("May", "April", etc.)
  const prevMonthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 2).toLocaleString("default", { month: "long" });
  }, [month]);

  // Load auto-save rules whenever Budget Rules tab is opened
  useEffect(() => {
    if (budgetTab !== "budget-rules") return;
    setAutoSaveLoading(true);
    getAutoSaveRules()
      .then(setAutoSaveRules)
      .catch(() => showToast("Could not load auto-save rules", "error"))
      .finally(() => setAutoSaveLoading(false));
  }, [budgetTab]); // eslint-disable-line

  const handleRolloverToggle = async (budget) => {
    setTogglingRollover(budget.id);
    try {
      await updateBudgetRollover(budget.id, !budget.rollover_enabled);
      await load();
      showToast(
        `Rollover ${!budget.rollover_enabled ? "enabled" : "disabled"} for ${titleCaseCategory(budget.category)}`,
        "success"
      );
    } catch {
      showToast("Could not update rollover setting", "error");
    } finally {
      setTogglingRollover(null);
    }
  };

  const handleAddAutoSaveRule = async (e) => {
    e.preventDefault();
    const val = parseFloat(autoSaveForm.value);
    if (!autoSaveForm.goal_id || Number.isNaN(val) || val <= 0) return;
    if (autoSaveForm.type === "percent" && val > 100) {
      showToast("Percent value cannot exceed 100", "error");
      return;
    }
    setSavingAutoRule(true);
    try {
      const rule = await createAutoSaveRule({
        goal_id: Number(autoSaveForm.goal_id),
        type: autoSaveForm.type,
        value: val,
      });
      setAutoSaveRules((prev) => [rule, ...prev]);
      setAutoSaveForm({ goal_id: "", type: "fixed", value: "" });
      showToast("Auto-save rule added", "success");
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not add rule";
      showToast(typeof msg === "string" ? msg : "Could not add rule", "error");
    } finally {
      setSavingAutoRule(false);
    }
  };

  const handleDeleteAutoSaveRule = async (id) => {
    setDeletingRuleId(id);
    try {
      await deleteAutoSaveRule(id);
      setAutoSaveRules((prev) => prev.filter((r) => r.id !== id));
      showToast("Rule removed", "success");
    } catch {
      showToast("Could not remove rule", "error");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const totalBudget    = vs ? Number(vs.total_budget)    : 0;
  const totalSpent     = vs ? Number(vs.total_spent)     : 0;
  const totalRemaining = vs ? Number(vs.total_remaining) : 0;
  const summaryPct     = pctUsed(totalSpent, totalBudget);

  const monthlyIncome  = incomeByMonth[month] || 0;
  const currentSavings = Math.max(0, monthlyIncome - totalSpent);

  const askAIExplain = async () => {
    if (explaining) return;
    setExplaining(true);
    try {
      const res = await API.post("/ai/chat", {
        message: "Explain this",
        context: "Budgets page: budget vs actual performance summary.",
        data: { month, totalBudget, totalSpent, totalRemaining,
          categories: categories.map((c) => ({
            category: c.category, spent: c.actual_spent,
            limit: c.budget, usagePct: Number(c.pct.toFixed(1)),
          })),
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
      setExplaining(false);
    }
  };

  const btnPrimary   = "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 disabled:opacity-50";
  const btnSecondary = "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-subtle dark:hover:bg-white/5 dark:hover:text-white";

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* ── Savings goals section ─────────────────────── */}
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Savings goals</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">Track progress towards your money milestones.</p>
        </div>
        <button type="button" onClick={() => setGoalModalOpen(true)}
          className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400">
          New goal
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => {
          const rawPct    = g.saved_amount / g.target_amount;
          const pct       = Math.min(100, Math.max(0, rawPct * 100));
          const completed = pct >= 100;
          const remaining = Math.max(0, g.target_amount - g.saved_amount);
          const monthsLeft = currentSavings > 0 && !completed ? Math.ceil(remaining / currentSavings) : null;

          return (
            <Card key={g.id}>
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                    {g.deadline && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-app-muted">By {g.deadline}</p>
                    )}
                  </div>
                  <button onClick={() => handleDeleteGoal(g.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400">
                    Delete
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatINR(g.saved_amount)}
                    </span>
                    <span className="text-gray-400 dark:text-app-muted">of {formatINR(g.target_amount)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${completed ? "bg-emerald-500" : "bg-cyan-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-app-muted">
                    {completed ? (
                      /* CheckCircle2 replaces 🎉 emoji */
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Completed
                      </span>
                    ) : currentSavings <= 0 ? (
                      <span>Add income to estimate</span>
                    ) : (
                      <span>Est. {monthsLeft} months at current rate</span>
                    )}
                  </div>
                  {!completed && (
                    <button
                      onClick={() => handleAddFunds(g)}
                      disabled={saving}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
        {goals.length === 0 && (
          <div className="col-span-full">
            <EmptyState title="No active goals" description="Set your sights on something big and start saving." />
          </div>
        )}
      </div>

      {/* ── Budgets section ───────────────────────────── */}
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Budgets</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">
            Plan limits and track spending against them by month.
          </p>
        </div>
        {budgetTab === "my-budgets" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-app-subtle">
              <span className="whitespace-nowrap">Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:focus:border-cyan-500/40"
              />
            </label>
            <button type="button" onClick={askAIExplain}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-app-card dark:text-app-subtle dark:hover:bg-white/5">
              {explaining ? "Explaining…" : "Explain this"}
            </button>
            <button type="button" onClick={() => setModalOpen(true)}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400">
              New budget
            </button>
          </div>
        )}
      </div>

      {/* ── Tab switcher ─────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/[0.06] dark:bg-white/[0.03]">
        {[
          { id: "my-budgets",   label: "My Budgets" },
          { id: "ai-suggested", label: "AI Suggested" },
          { id: "budget-rules", label: "Budget Rules" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBudgetTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              budgetTab === tab.id
                ? "bg-white text-gray-900 shadow-sm dark:bg-app-card dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-app-muted dark:hover:text-white"
            }`}
          >
            {tab.id === "ai-suggested" && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── AI Suggested Budgets tab ─────────────────── */}
      {budgetTab === "ai-suggested" && (
        <>
          {suggestionsLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardBody className="py-8">
                <EmptyState
                  icon={Sparkles}
                  title="No suggestions yet"
                  description="Add at least 2 transactions per category over the last 4 months to unlock AI budget suggestions."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((s, i) => {
                const alreadySet = s.existing_budget != null;
                const editVal    = suggestEditAmounts[s.category] ?? String(s.suggested_budget);
                const isAccepting = acceptingSuggestion === s.category;
                return (
                  <motion.div
                    key={s.category}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07 }}
                  >
                    <Card>
                      <CardBody className="space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-gray-900 dark:text-white">
                              {titleCaseCategory(s.category)}
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-400 dark:text-app-muted">
                              Avg.{" "}
                              {formatINR(s.avg_monthly_spend)}
                              /mo · {s.months_analyzed} mo analyzed
                            </p>
                          </div>
                          {alreadySet && (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                              Set
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-app-muted">
                            Suggested limit (₹)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="100"
                            value={editVal}
                            onChange={(e) =>
                              setSuggestEditAmounts((prev) => ({ ...prev, [s.category]: e.target.value }))
                            }
                            disabled={alreadySet}
                            className={fieldClass + (alreadySet ? " opacity-50 cursor-not-allowed" : "")}
                          />
                        </div>

                        {alreadySet ? (
                          <p className="text-xs text-gray-400 dark:text-app-muted">
                            Already set to{" "}
                            <span className="font-medium text-gray-600 dark:text-app-subtle">
                              {formatINR(s.existing_budget)}
                            </span>{" "}
                            — manage in <strong>My Budgets</strong>.
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAcceptSuggestion(s.category)}
                            disabled={isAccepting}
                            className={btnPrimary + " w-full text-center"}
                          >
                            {isAccepting ? "Saving…" : "Accept"}
                          </button>
                        )}
                      </CardBody>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Budget Rules tab ─────────────────────────── */}
      {budgetTab === "budget-rules" && (
        <div className="space-y-8">

          {/* ── Rollover section ──────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Unused Budget Rollover</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-app-muted">
              When enabled, any unspent budget from the previous month is added to next month&apos;s limit automatically.
              Overspending never reduces a future month&apos;s budget.
            </p>

            <div className="mt-4 space-y-3">
              {monthBudgetRows.length === 0 ? (
                <Card>
                  <CardBody className="py-6 text-center">
                    <p className="text-sm text-gray-400 dark:text-app-muted">
                      No budgets set for {month}. Create a budget on the{" "}
                      <button
                        type="button"
                        onClick={() => setBudgetTab("my-budgets")}
                        className="font-medium text-cyan-600 underline-offset-2 hover:underline dark:text-cyan-400"
                      >
                        My Budgets
                      </button>{" "}
                      tab first.
                    </p>
                  </CardBody>
                </Card>
              ) : (
                monthBudgetRows.map((budget) => (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-app-card"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {titleCaseCategory(budget.category)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-app-muted">
                        Limit: {formatINR(budget.amount)} / month
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-app-muted">
                        {budget.rollover_enabled ? "Rollover on" : "Rollover off"}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={budget.rollover_enabled}
                        disabled={togglingRollover === budget.id}
                        onClick={() => handleRolloverToggle(budget)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                          budget.rollover_enabled
                            ? "bg-cyan-500"
                            : "bg-gray-200 dark:bg-white/20"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            budget.rollover_enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Auto-Save Rules section ───────────────── */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Auto-Save Rules</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-app-muted">
              Each time you log new income, these rules automatically allocate a portion toward your savings goals.
              Nothing moves between real bank accounts — this only updates goal progress inside FinPulse.
            </p>

            {autoSaveLoading ? (
              <div className="mt-4 space-y-3">
                <CardSkeleton /><CardSkeleton />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {autoSaveRules.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-400 dark:border-white/[0.08] dark:text-app-muted">
                    No auto-save rules yet. Add one below.
                  </p>
                ) : (
                  autoSaveRules.map((rule) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-app-card"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.goal_name}</p>
                        <p className="text-xs text-gray-400 dark:text-app-muted">
                          {rule.type === "fixed"
                            ? `${formatINR(rule.value)} allocated on each new income`
                            : `${rule.value}% of income allocated`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAutoSaveRule(rule.id)}
                        disabled={deletingRuleId === rule.id}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {deletingRuleId === rule.id ? "Removing…" : "Remove"}
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* Add rule form */}
            {goals.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-400 dark:border-white/[0.08] dark:text-app-muted">
                Create a savings goal first before adding auto-save rules.
              </p>
            ) : (
              <form
                onSubmit={handleAddAutoSaveRule}
                className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <p className="mb-3 text-sm font-medium text-gray-700 dark:text-app-subtle">Add a new rule</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-app-muted">Goal</label>
                    <select
                      value={autoSaveForm.goal_id}
                      onChange={(e) => setAutoSaveForm((f) => ({ ...f, goal_id: e.target.value }))}
                      required
                      className={fieldClass}
                    >
                      <option value="">Select goal…</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-app-muted">Type</label>
                    <select
                      value={autoSaveForm.type}
                      onChange={(e) => setAutoSaveForm((f) => ({ ...f, type: e.target.value }))}
                      className={fieldClass}
                    >
                      <option value="fixed">Fixed amount (₹)</option>
                      <option value="percent">Percent of income (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-app-muted">
                      {autoSaveForm.type === "fixed" ? "Amount (₹)" : "Percent (%)"}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={autoSaveForm.type === "percent" ? 100 : undefined}
                      value={autoSaveForm.value}
                      onChange={(e) => setAutoSaveForm((f) => ({ ...f, value: e.target.value }))}
                      placeholder={autoSaveForm.type === "fixed" ? "e.g. 2000" : "e.g. 10"}
                      required
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="submit" disabled={savingAutoRule} className={btnPrimary}>
                    {savingAutoRule ? "Adding…" : "Add rule"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── My Budgets tab ───────────────────────────── */}
      {budgetTab === "my-budgets" && (
        <>

      {error && <AlertBanner message={error} onDismiss={() => setError("")} type="error" />}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        </div>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card hover>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Total budget</p>
                <p className="mt-1.5 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatINR(totalBudget)}</p>
              </CardBody>
            </Card>
            <Card hover>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Spent</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatINR(totalSpent)}</p>
                <div className="mt-3"><ProgressBar pct={summaryPct} tone={budgetUsageTone(summaryPct)} /></div>
              </CardBody>
            </Card>
            <Card hover>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Remaining</p>
                <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${totalRemaining < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatINR(totalRemaining)}
                </p>
                <p className="mt-1.5 text-xs text-gray-400 dark:text-app-muted">{vs?.status || "—"}</p>
              </CardBody>
            </Card>
          </div>

          {/* Budget category cards */}
          {categories.length === 0 ? (
            <Card>
              <CardBody className="py-8">
                <EmptyState icon={Wallet} title="No budgets set. Create your first monthly budget."
                  actionLabel="New Budget" onAction={() => setModalOpen(true)} />
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((row) => {
                const tone = budgetUsageTone(row.pct);
                const over = row.actual_spent > row.budget;
                return (
                  <Card key={`${row.category}-${month}`}>
                    <CardHeader
                      title={titleCaseCategory(row.category)}
                      subtitle={over ? "Over budget" : "Within plan"}
                    />
                    <CardBody className="space-y-3 pt-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-app-muted">Spent</span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatINR(row.actual_spent)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-app-muted">Limit</span>
                        <span className="font-medium tabular-nums text-gray-700 dark:text-app-subtle">{formatINR(row.budget)}</span>
                      </div>
                      {row.rollover_amount > 0 && (
                        <p className="text-xs text-cyan-600 dark:text-cyan-400">
                          Includes {formatINR(row.rollover_amount)} rolled over from {prevMonthLabel}
                        </p>
                      )}
                      <div>
                        <div className="mb-1.5 flex justify-between text-xs text-gray-400 dark:text-app-muted">
                          <span>Usage</span>
                          <span className="font-medium tabular-nums text-gray-600 dark:text-app-subtle">{row.pct.toFixed(0)}%</span>
                        </div>
                        <ProgressBar pct={Math.min(row.pct, 100)} tone={tone} />
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                        <span className={`text-xs font-medium ${row.remaining < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {row.remaining < 0 ? "Over by " : "Left: "}{formatINR(Math.abs(row.remaining))}
                        </span>
                        {monthBudgetRows.find((b) => b.category === row.category) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(monthBudgetRows.find((b) => b.category === row.category).id)}
                            className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}

          <ConfirmDialog
            isOpen={!!deleteBudgetId}
            title="Delete Budget"
            message="Are you sure you want to delete this budget? This action cannot be undone."
            onConfirm={confirmDelete}
            onCancel={() => setDeleteBudgetId(null)}
          />

          {aiExplanation && (
            <Card>
              <div
                ref={(el) => (explanationRef.current = el)}
                className={highlightExplanation ? "rounded-2xl ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#F5F7FB] transition" : ""}
              >
                <CardHeader title="AI Explanation" subtitle="Budget-focused recommendation" />
              </div>
              <CardBody className="pt-0">
                <FormattedAIResponse text={aiExplanation} />
              </CardBody>
            </Card>
          )}
        </>
      )}
        </>
      )}

      {/* ── New budget modal ──────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="New budget"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="budget-form" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save budget"}
            </button>
          </>
        }
      >
        <form id="budget-form" onSubmit={handleCreate} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-app-muted">
            Month: <span className="font-medium text-gray-900 dark:text-app-subtle">{month}</span>
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Category</label>
            <select
              name="category"
              value={form.category ? getCategoryMeta(form.category).value : ""}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={fieldClass}
              required
            >
              <option value="" disabled>Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.value}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Monthly limit</label>
            <input name="amount" type="number" min="0" step="0.01" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={fieldClass} placeholder="0" required />
          </div>
        </form>
      </Modal>

      {/* ── New goal modal ────────────────────────────── */}
      <Modal
        open={goalModalOpen}
        onClose={() => !saving && setGoalModalOpen(false)}
        title="New savings goal"
        footer={
          <>
            <button type="button" onClick={() => setGoalModalOpen(false)} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="goal-form" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save goal"}
            </button>
          </>
        }
      >
        <form id="goal-form" onSubmit={handleCreateGoal} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Goal name</label>
            <input name="name" value={goalForm.name}
              onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldClass} placeholder="e.g. Vacation" required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Target amount</label>
            <input name="target_amount" type="number" min="0" step="0.01" value={goalForm.target_amount}
              onChange={(e) => setGoalForm((f) => ({ ...f, target_amount: e.target.value }))}
              className={fieldClass} placeholder="1000" required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Deadline (optional)</label>
            <input type="month" name="deadline" value={goalForm.deadline}
              onChange={(e) => setGoalForm((f) => ({ ...f, deadline: e.target.value }))}
              className={fieldClass} />
          </div>
        </form>
      </Modal>

      {/* ── Add Funds modal (replaces window.prompt) ─── */}
      <Modal
        open={addFundsModal}
        onClose={() => !addFundsSaving && setAddFundsModal(false)}
        title={`Add funds to "${addFundsGoal?.name ?? ""}"`}
        footer={
          <>
            <button type="button" onClick={() => setAddFundsModal(false)} disabled={addFundsSaving} className={btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAddFunds}
              disabled={addFundsSaving || !addFundsAmount || parseFloat(addFundsAmount) <= 0}
              className={btnPrimary}
            >
              {addFundsSaving ? "Saving…" : "Add funds"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-app-muted">
            Current savings:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatINR(addFundsGoal?.saved_amount ?? 0)}
            </span>{" "}
            of {formatINR(addFundsGoal?.target_amount ?? 0)}
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
              Amount to add (₹)
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={addFundsAmount}
              onChange={(e) => setAddFundsAmount(e.target.value)}
              placeholder="e.g. 500"
              className={fieldClass}
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
