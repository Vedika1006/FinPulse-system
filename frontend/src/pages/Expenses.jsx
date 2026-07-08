import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getExpenses, addExpense, deleteExpense } from "../api/expenses";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { TableSkeleton } from "../components/ui/Skeleton";
import { Receipt, Download, Sparkles, AlertTriangle } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { formatCurrency } from "../utils/currency";
import FormattedAIResponse from "../components/FormattedAIResponse";
import NLExpenseInput from "../components/NLExpenseInput";
import ReceiptScanner from "../components/ReceiptScanner";
import CategorySuggester from "../components/CategorySuggester";

// Severity badge rendered inline on anomalous table rows.
// `title` gives a native browser tooltip with the reason on hover.
const AnomalyBadge = ({ severity, reason }) => {
  const classes = {
    high:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    medium:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    low:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
  };
  const labels = { high: "Anomaly", medium: "Unusual", low: "Watch" };

  return (
    <span
      title={reason}
      className={`ml-2 inline-flex cursor-help items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        classes[severity] ?? classes.low
      }`}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {labels[severity] ?? "Watch"}
    </span>
  );
};

// today in YYYY-MM-DD (local time) — used for default value & max constraint
const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const Expenses = () => {
  const { showToast } = useToast();
  const { currency } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [expenses, setExpenses] = useState([]);
  const [anomalyMap, setAnomalyMap] = useState({}); // { [expense_id]: { severity, reason } }
  const [showForm, setShowForm] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const explanationRef = useState(() => ({ current: null }))[0];
  const [highlightExplanation, setHighlightExplanation] = useState(false);

  const selectedCategory = (searchParams.get("category") || "").trim();
  const categoryLabel = selectedCategory
    ? selectedCategory
        .split(/[\s_-]+/g)
        .filter(Boolean)
        .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "";

  const [form, setForm] = useState({
    category: "",
    amount: "",
    date: getTodayStr(),   // default to today
    description: "",
  });
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch anomalies separately so a slow ML call never blocks the expense list.
  const fetchAnomalies = async () => {
    try {
      const res = await API.get("/analytics/anomalies");
      const list = res.data?.anomalies ?? [];
      const map = {};
      for (const a of list) {
        map[a.expense_id] = { severity: a.severity, reason: a.reason };
      }
      setAnomalyMap(map);
    } catch (err) {
      // Anomaly detection is non-critical — fail silently.
      console.warn("[Anomaly] Could not load:", err?.response?.data ?? err.message);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchAnomalies();
  }, []);

  // Refresh anomalies after adding/deleting so badges stay current.
  const refreshAll = () => {
    fetchExpenses();
    fetchAnomalies();
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const visibleExpenses = useMemo(() => {
    if (!selectedCategory) return expenses;
    return expenses.filter(
      (e) =>
        String(e.category || "").toLowerCase() ===
        selectedCategory.toLowerCase()
    );
  }, [expenses, selectedCategory]);

  const anomalyCount = Object.keys(anomalyMap).length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const exportToCSV = () => {
    if (visibleExpenses.length === 0) return;
    const headers = ["Date", "Category", "Amount", "Description", "Note"];
    const rows = visibleExpenses.map((exp) => {
      const rawDate = exp.date || exp.created_at;
      const dateStr = rawDate ? rawDate.substring(0, 10) : "";
      const desc = (exp.description || "").replace(/"/g, '""');
      const note = (exp.note || "").replace(/"/g, '""');
      return [
        `"${dateStr}"`,
        `"${exp.category || ""}"`,
        exp.amount,
        `"${desc}"`,
        `"${note}"`,
      ];
    });
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "expenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount, 10);
    if (Number.isNaN(amount) || amount <= 0) return;
    try {
      await addExpense({
        category: form.category.trim(),
        amount,
        description:
          form.description.trim() ||
          (form.date ? `Spent on ${form.date}` : null),
        note: form.description.trim() || null,
        date: form.date ? new Date(form.date).toISOString() : null,
      });
      setForm({ category: "", amount: "", date: "", description: "" });
      setShowForm(false);
      refreshAll();
    } catch (err) {
      console.error("ERROR:", err.response || err);
    }
  };

  const handleDelete = (id) => setExpenseToDelete(id);
  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    await deleteExpense(expenseToDelete);
    setExpenseToDelete(null);
    refreshAll();
  };

  const askAIExplain = async () => {
    if (explaining) return;
    setExplaining(true);
    try {
      const context = expenses.slice(0, 20).map((exp) => ({
        category: exp.category,
        amount: Number(exp.amount || 0),
        date: exp.date || exp.created_at,
      }));
      const res = await API.post("/ai/chat", {
        message: "Explain this",
        context: "Expenses page: recent expense ledger (top 20).",
        data: { rows: context },
      });
      const reply = res.data?.reply || "No explanation available right now.";
      setAiExplanation(reply);
      showToast("AI explanation ready", "success", {
        onClick: () => {
          explanationRef.current?.scrollIntoView?.({
            behavior: "smooth",
            block: "start",
          });
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

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-app-surface/80 dark:text-white dark:placeholder:text-app-muted dark:focus:border-app-accent/50 dark:focus:ring-app-accent/25";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-app-muted">
            Review, add, and curate your ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={askAIExplain}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1E2247] dark:text-[#C9D1E3]"
        >
          {explaining ? "Explaining..." : "Explain this"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={visibleExpenses.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-app-card dark:text-app-muted dark:hover:bg-white/5 dark:focus:ring-white/10"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({ category: "", amount: "", date: getTodayStr(), description: "" });
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:shadow-glow-sm"
          >
            + Add expense
          </button>
        </div>
      </div>

      {/* Smart Add */}
      <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 dark:bg-purple-900/10 dark:border-purple-800/30">
        <div className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          Smart Add
        </div>
        <NLExpenseInput onExpenseAdded={refreshAll} autoFocus={searchParams.get("focus") === "add"} />
      </div>

      {/* Anomaly summary banner — only shown when ML has flagged something */}
      {anomalyCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{anomalyCount} unusual expense{anomalyCount > 1 ? "s" : ""}</span>
            {" "}detected by Isolation Forest — hover the badge on any flagged row for details.
          </span>
        </div>
      )}

      {/* Expense table */}
      <Card>
        <CardHeader
          title="All expenses"
          subtitle="Sorted as returned from your workspace"
          action={
            selectedCategory ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-900 dark:border-white/15 dark:bg-transparent dark:text-white">
                  Category: {categoryLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("category");
                    setSearchParams(next, { replace: true });
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                >
                  Clear
                </button>
              </div>
            ) : null
          }
        />
        <CardBody className="overflow-x-auto px-0 pb-0 pt-0">
          {loading ? (
            <div className="p-6">
              <TableSkeleton />
            </div>
          ) : visibleExpenses.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Receipt}
                title="No expenses yet. Start tracking your spending."
                actionLabel="Add Expense"
                onAction={() => setShowForm(true)}
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:text-app-muted">
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.map((exp) => {
                  const anomaly = anomalyMap[exp.id];
                  return (
                    <tr
                      key={exp.id}
                      className={`border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/[0.04] ${
                        anomaly
                          ? "bg-amber-50/40 dark:bg-amber-500/[0.04]"
                          : ""
                      }`}
                    >
                      {/* Category — badge sits here, next to the category name */}
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-app-subtle">
                        <span className="inline-flex items-center flex-wrap gap-x-1">
                          {String(exp.category || "")
                            .split(/[\s_-]+/g)
                            .filter(Boolean)
                            .map(
                              (w) =>
                                w.slice(0, 1).toUpperCase() +
                                w.slice(1).toLowerCase()
                            )
                            .join(" ")}
                          {anomaly && (
                            <AnomalyBadge
                              severity={anomaly.severity}
                              reason={anomaly.reason}
                            />
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-3 tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(exp.amount, currency)}
                      </td>

                      <td className="px-6 py-3 text-gray-600 dark:text-app-muted">
                        {(exp.date || exp.created_at)
                          ? new Date(exp.date || exp.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-6 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        isOpen={!!expenseToDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setExpenseToDelete(null)}
      />

      {/* AI explanation card */}
      {aiExplanation ? (
        <Card>
          <div
            ref={(el) => (explanationRef.current = el)}
            className={
              highlightExplanation
                ? "rounded-2xl ring-2 ring-blue-600 ring-offset-2 ring-offset-[#F5F7FB] transition"
                : ""
            }
          >
            <CardHeader
              title="AI Explanation"
              subtitle="Spending behavior summary"
            />
          </div>
          <CardBody className="pt-0">
            <FormattedAIResponse text={aiExplanation} />
          </CardBody>
        </Card>
      ) : null}

      {/* Add expense modal */}
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40 dark:bg-black/60"
            aria-label="Close modal overlay"
            onClick={() => setShowForm(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-0 shadow-lg dark:border-white/10 dark:bg-app-card">
            <div className="border-b border-gray-200 px-6 py-4 text-left dark:border-white/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add expense
              </h3>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-app-muted">
                Details sync instantly with your backend.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 px-6 py-5 text-left"
            >
              <ReceiptScanner
                onExtracted={(data) => {
                  setForm((f) => ({
                    ...f,
                    amount:
                      data?.amount != null ? String(data.amount) : f.amount,
                    category: data?.category
                      ? String(data.category).trim().toLowerCase()
                      : f.category,
                    date: data?.date || f.date,
                    description:
                      [data?.merchant, data?.description]
                        .filter(Boolean)
                        .join(" — ") || f.description,
                  }));
                  showToast(
                    "Receipt scanned — review fields and save",
                    "success"
                  );
                }}
              />
              <CategorySuggester
                merchant={form.description}
                onSuggest={(result) => {
                  if (!form.category || form.category === "Other") {
                    setForm({ ...form, category: result.category });
                  }
                }}
              />
              <input
                type="text"
                name="category"
                placeholder="Category"
                value={form.category}
                onChange={handleChange}
                className={inputClass}
                required
              />
              <input
                type="number"
                name="amount"
                placeholder="Amount"
                value={form.amount}
                onChange={handleChange}
                className={inputClass}
                required
              />
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                max={getTodayStr()}
                className={inputClass}
                required
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-app-subtle dark:hover:bg-white/10 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:shadow-glow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Expenses;