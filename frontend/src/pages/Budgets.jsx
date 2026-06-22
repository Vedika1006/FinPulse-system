import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getBudgets,
  createBudget,
  getBudgetVsActual,
} from "../api/budgets";
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
import FormattedAIResponse from "../components/FormattedAIResponse";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Wallet } from "lucide-react";

function pctUsed(spent, budget) {
  const b = Number(budget);
  const s = Number(spent);
  if (!b || b <= 0) return 0;
  return (s / b) * 100;
}

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-app-surface/90 dark:text-white dark:placeholder:text-app-muted dark:focus:border-app-accent/50 dark:focus:ring-app-accent/25";

export default function Budgets() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currency, currencySymbol } = useTheme();
  const formatINR = (v) => globalFormatCurrency(v, currency);
  const [month, setMonth] = useState(currentMonthParam);
  const [vs, setVs] = useState(null);
  const [allBudgets, setAllBudgets] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState([]);
  const [incomeByMonth, setIncomeByMonth] = useState({});
  const [explaining, setExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const explanationRef = useState(() => ({ current: null }))[0];
  const [highlightExplanation, setHighlightExplanation] = useState(false);
  const [form, setForm] = useState({
    category: "",
    amount: "",
  });
  const [goalForm, setGoalForm] = useState({
    name: "",
    target_amount: "",
    deadline: "",
  });
  const [deleteBudgetId, setDeleteBudgetId] = useState(null);

  const titleCaseCategory = (value) =>
    String(value || "")
      .split(/[\s_-]+/g)
      .filter(Boolean)
      .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  // Deep-link action flow: /budgets?category=Food&month=YYYY-MM
  useEffect(() => {
    const cat = searchParams.get("category");
    const m = searchParams.get("month");
    if (m && typeof m === "string" && m !== month) setMonth(m);
    if (cat && typeof cat === "string") {
      setForm((f) => ({ ...f, category: cat }));
      setModalOpen(true);
      // Clear params after applying to avoid re-opening on back/refresh
      const next = new URLSearchParams(searchParams);
      next.delete("category");
      next.delete("month");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const msg =
        e.response?.data?.error ||
        e.response?.data?.detail ||
        e.message ||
        "Failed to load data";
      setError(typeof msg === "string" ? msg : "Failed to load data");
      setVs(null);
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
        const h = await getHealthScore(month);
        setHealth(h || null);
      } catch {
        setHealth(null);
      }
    })();
  }, [month]);

  const categories = useMemo(() => {
    if (!vs || !Array.isArray(vs.categories)) return [];
    return vs.categories.map((c) => ({
      ...c,
      budget: Number(c.budget),
      actual_spent: Number(c.actual_spent),
      remaining: Number(c.remaining),
      pct: pctUsed(c.actual_spent, c.budget),
    }));
  }, [vs]);

  const monthBudgetRows = useMemo(
    () => allBudgets.filter((b) => b.month === month),
    [allBudgets, month]
  );

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    const amount = parseFloat(goalForm.target_amount, 10);
    if (!goalForm.name.trim() || Number.isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await createGoal({
        name: goalForm.name.trim(),
        target_amount: amount,
        deadline: goalForm.deadline || undefined,
      });
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

  const handleCreate = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount, 10);
    if (!form.category.trim() || Number.isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await createBudget({
        category: form.category.trim(),
        amount,
        month,
      });
      setForm({ category: "", amount: "" });
      setModalOpen(false);
      showToast("Budget created", "success");
      await load();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Could not create budget";
      showToast(typeof msg === "string" ? msg : "Could not create budget", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteBudgetId(id);
  };
  const confirmDelete = async () => {
    if (!deleteBudgetId) return;
    try {
      await deleteBudget(deleteBudgetId);
      showToast("Budget removed", "success");
      setDeleteBudgetId(null);
      await load();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Could not delete";
      showToast(typeof msg === "string" ? msg : "Could not delete", "error");
    }
  };

  const totalBudget = vs ? Number(vs.total_budget) : 0;
  const totalSpent = vs ? Number(vs.total_spent) : 0;
  const totalRemaining = vs ? Number(vs.total_remaining) : 0;
  const summaryPct = pctUsed(totalSpent, totalBudget);

  const askAIExplain = async () => {
    if (explaining) return;
    setExplaining(true);
    try {
      const context = {
        month,
        totalBudget,
        totalSpent,
        totalRemaining,
        categories: categories.map((c) => ({
          category: c.category,
          spent: c.actual_spent,
          limit: c.budget,
          usagePct: Number(c.pct.toFixed(1)),
        })),
      };
      const res = await API.post("/ai/chat", {
        message: "Explain this",
        context: "Budgets page: budget vs actual performance summary.",
        data: context,
      });
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
      setExplaining(false);
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

  const handleAddFunds = async (g) => {
    const amountStr = window.prompt(`How much would you like to save towards '${g.name}'?`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) return;
    
    setSaving(true);
    try {
      await updateGoal(g.id, { saved_amount: g.saved_amount + amount });
      showToast("Funds added to goal!", "success");
      await load();
    } catch {
      showToast("Could not add funds to goal", "error");
    } finally {
      setSaving(false);
    }
  };

  const monthlyIncome = incomeByMonth[month] || 0;
  const currentSavings = Math.max(0, monthlyIncome - totalSpent);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Savings goals</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-app-muted">Track progress towards your money milestones.</p>
        </div>
        <button
          type="button"
          onClick={() => setGoalModalOpen(true)}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:shadow-glow-sm"
        >
          New goal
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => {
          const rawPct = g.saved_amount / g.target_amount;
          const pct = Math.min(100, Math.max(0, rawPct * 100));
          const completed = pct >= 100;
          const remaining = Math.max(0, g.target_amount - g.saved_amount);
          const monthsLeft = (currentSavings > 0 && !completed) ? Math.ceil(remaining / currentSavings) : null;
          
          return (
            <Card key={g.id}>
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                    {g.deadline && <p className="text-xs text-gray-500 dark:text-app-muted">By {g.deadline}</p>}
                  </div>
                  <button onClick={() => handleDeleteGoal(g.id)} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Delete</button>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{formatINR(g.saved_amount)}</span>
                    <span className="text-gray-500 dark:text-app-muted">of {formatINR(g.target_amount)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-2xl bg-gray-200 dark:bg-white/10">
                    <div className={`h-2 rounded-2xl transition-all duration-500 ${completed ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600 dark:text-app-muted">
                    {completed ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Completed! 🎉</span>
                    ) : currentSavings <= 0 ? (
                      <span>Add income to estimate</span>
                    ) : (
                      <span>Est. {monthsLeft} months at current rate</span>
                    )}
                  </div>
                  {!completed ? (
                    <button 
                      onClick={() => handleAddFunds(g)} 
                      disabled={saving}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    >
                      + Add
                    </button>
                  ) : null}
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

      <div className="mt-8 flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Budgets</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-app-muted">
            Plan limits and track spending against them by month.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-app-subtle">
            <span className="whitespace-nowrap">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-app-surface/90 dark:text-white dark:focus:border-app-accent/50 dark:focus:ring-app-accent/25"
            />
          </label>
          <button
            type="button"
            onClick={askAIExplain}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1E2247] dark:text-[#C9D1E3]"
          >
            {explaining ? "Explaining..." : "Explain this"}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:shadow-glow-sm"
          >
            New budget
          </button>
        </div>
      </div>

      {error ? (
        <AlertBanner message={error} onDismiss={() => setError("")} type="error" />
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card hover>
              <CardBody>
                <p className="text-sm font-medium text-gray-500 dark:text-app-muted">Total budget</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {formatINR(totalBudget)}
                </p>
              </CardBody>
            </Card>
            <Card hover>
              <CardBody>
                <p className="text-sm font-medium text-gray-500 dark:text-app-muted">Spent</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {formatINR(totalSpent)}
                </p>
                <div className="mt-3">
                  <ProgressBar pct={summaryPct} tone={budgetUsageTone(summaryPct)} />
                </div>
              </CardBody>
            </Card>
            <Card hover>
              <CardBody>
                <p className="text-sm font-medium text-gray-500 dark:text-app-muted">Remaining</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    totalRemaining < 0 ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {formatINR(totalRemaining)}
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-app-muted">{vs?.status || "—"}</p>
              </CardBody>
            </Card>
          </div>

          {categories.length === 0 ? (
            <Card>
              <CardBody className="py-8">
                <EmptyState
                  icon={Wallet}
                  title="No budgets set. Create your first monthly budget."
                  actionLabel="New Budget"
                  onAction={() => setModalOpen(true)}
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((row) => {
                const tone = budgetUsageTone(row.pct);
                const over = row.actual_spent > row.budget;
                return (
                  <Card key={`${row.category}-${month}`}>
                    <CardHeader title={titleCaseCategory(row.category)} subtitle={over ? "Over budget" : "Within plan"} />
                    <CardBody className="space-y-3 pt-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-app-muted">Spent</span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {formatINR(row.actual_spent)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-app-muted">Limit</span>
                        <span className="font-medium tabular-nums text-gray-700 dark:text-app-subtle">
                          {formatINR(row.budget)}
                        </span>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-app-muted">
                          <span>Usage</span>
                          <span className="tabular-nums font-medium text-gray-700 dark:text-app-subtle">
                            {row.pct.toFixed(0)}%
                          </span>
                        </div>
                        <ProgressBar pct={Math.min(row.pct, 100)} tone={tone} />
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-white/10">
                        <span
                          className={`text-xs font-medium ${
                            row.remaining < 0 ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {row.remaining < 0 ? "Over by " : "Left: "}
                          {formatINR(Math.abs(row.remaining))}
                        </span>
                        {monthBudgetRows.find((b) => b.category === row.category) ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(monthBudgetRows.find((b) => b.category === row.category).id)
                            }
                            className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                          >
                            Delete
                          </button>
                        ) : null}
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

          {aiExplanation ? (
            <Card>
              <div
                ref={(el) => (explanationRef.current = el)}
                className={highlightExplanation ? "rounded-2xl ring-2 ring-blue-600 ring-offset-2 ring-offset-[#F5F7FB] transition" : ""}
              >
                <CardHeader title="AI Explanation" subtitle="Budget-focused recommendation" />
              </div>
              <CardBody className="pt-0">
                <FormattedAIResponse text={aiExplanation} />
              </CardBody>
            </Card>
          ) : null}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="New budget"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-app-subtle dark:hover:bg-white/10 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="budget-form"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:shadow-glow-sm"
            >
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
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-app-subtle">Category</label>
            <input
              name="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={fieldClass}
              placeholder="e.g. Food"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-app-subtle">Monthly limit</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={fieldClass}
              placeholder="0"
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={goalModalOpen}
        onClose={() => !saving && setGoalModalOpen(false)}
        title="New savings goal"
        footer={
          <>
            <button
              type="button"
              onClick={() => setGoalModalOpen(false)}
              disabled={saving}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-app-subtle dark:hover:bg-white/10 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="goal-form"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:shadow-glow-sm"
            >
              {saving ? "Saving…" : "Save goal"}
            </button>
          </>
        }
      >
        <form id="goal-form" onSubmit={handleCreateGoal} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-app-subtle">Goal name</label>
            <input
              name="name"
              value={goalForm.name}
              onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldClass}
              placeholder="e.g. Vacation"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-app-subtle">Target amount</label>
            <input
              name="target_amount"
              type="number"
              min="0"
              step="0.01"
              value={goalForm.target_amount}
              onChange={(e) => setGoalForm((f) => ({ ...f, target_amount: e.target.value }))}
              className={fieldClass}
              placeholder="1000"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-app-subtle">Deadline (optional)</label>
            <input
              type="month"
              name="deadline"
              value={goalForm.deadline}
              onChange={(e) => setGoalForm((f) => ({ ...f, deadline: e.target.value }))}
              className={fieldClass}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
