import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Home,
  Car,
  GraduationCap,
  CreditCard,
  ShoppingBag,
  Wallet,
  Landmark,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import API from "../api/axios";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useToast } from "../components/ToastProvider";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.28 },
  }),
};

const LOAN_TYPES = [
  { value: "home", label: "Home Loan", Icon: Home },
  { value: "car", label: "Car Loan", Icon: Car },
  { value: "personal", label: "Personal Loan", Icon: Wallet },
  { value: "education", label: "Education Loan", Icon: GraduationCap },
  { value: "credit_card", label: "Credit Card", Icon: CreditCard },
  { value: "consumer", label: "Consumer / No-Cost EMI", Icon: ShoppingBag },
  { value: "other", label: "Other", Icon: Landmark },
];
const LOAN_TYPE_MAP = Object.fromEntries(LOAN_TYPES.map((t) => [t.value, t]));

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:placeholder:text-app-muted dark:focus:border-cyan-500/40";
const btnPrimary =
  "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 disabled:opacity-50";
const btnSecondary =
  "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-subtle dark:hover:bg-white/5 dark:hover:text-white";

function fmt(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function monthLabel(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

const emptyForm = {
  name: "",
  loan_type: "personal",
  principal: "",
  interest_rate: "",
  tenure_months: "",
  start_date: "",
  emi_amount: "",
};

function SummaryCard({ label, value, border }) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card border-l-4 ${border}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-xl font-bold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function LoanCard({ loan, idx, selected, onClick }) {
  const typeInfo = LOAN_TYPE_MAP[loan.loan_type] || LOAN_TYPE_MAP.other;
  const Icon = typeInfo.Icon;
  const pct = loan.revised_tenure_months > 0 ? (loan.elapsed_months / loan.revised_tenure_months) * 100 : 0;
  const behind = loan.elapsed_months >= loan.tenure_months && loan.current_outstanding_balance > 0.01;

  return (
    <motion.div
      custom={idx}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      onClick={onClick}
      className={`rounded-2xl border bg-white dark:bg-app-card p-4 cursor-pointer transition-colors ${
        selected
          ? "border-cyan-400/50 dark:border-cyan-500/40"
          : "border-gray-100 dark:border-white/5 hover:border-cyan-400/30 dark:hover:border-cyan-500/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
            <Icon className="h-[18px] w-[18px] text-red-500 dark:text-red-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{loan.name}</p>
            <p className="text-xs text-gray-500 dark:text-app-muted">
              {Number(loan.interest_rate).toFixed(1)}% p.a.
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(loan.emi_amount)}/mo</p>
          <p className="text-xs text-gray-500 dark:text-app-muted">
            Outstanding {fmt(loan.current_outstanding_balance)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar pct={pct} tone={behind ? "danger" : "teal"} />
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-app-muted">
          <span>{Math.round(pct)}% of tenure elapsed</span>
          <span>Next EMI: {monthLabel(loan.next_due_date)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function LoanDetailPanel({ detail, loading, onClose, prepayAmount, setPrepayAmount, onPrepay, prepaySaving, onMarkClosed, closing }) {
  if (loading || !detail) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-white/10" />
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-white/5" />
        <div className="h-40 rounded-xl bg-gray-100 dark:bg-white/5" />
      </div>
    );
  }

  const typeInfo = LOAN_TYPE_MAP[detail.loan_type] || LOAN_TYPE_MAP.other;
  const Icon = typeInfo.Icon;
  const step = Math.max(1, Math.floor(detail.schedule.length / 60));
  const chartData = detail.schedule
    .filter((_, i) => i % step === 0 || i === detail.schedule.length - 1)
    .map((m) => ({ date: monthLabel(m.date), balance: m.outstanding_balance }));
  const currentMonthIndex = detail.elapsed_months;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
            <Icon className="h-[18px] w-[18px] text-red-500 dark:text-red-400" aria-hidden />
          </div>
          <h3 className="pr-4 text-lg font-semibold text-gray-900 dark:text-white">{detail.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 transition-colors hover:text-gray-900 dark:text-app-muted dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-500 dark:text-app-muted">Outstanding balance</p>
          <p className="font-mono text-xl font-bold text-gray-900 dark:text-white">
            {fmt(detail.current_outstanding_balance)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-500 dark:text-app-muted">Monthly EMI</p>
          <p className="font-mono text-xl font-bold text-gray-900 dark:text-white">{fmt(detail.emi_amount)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-500 dark:text-app-muted">Interest paid so far</p>
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
            {fmt(detail.interest_paid_so_far)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-500 dark:text-app-muted">Interest remaining</p>
          <p className="text-base font-semibold text-amber-600 dark:text-amber-400">
            {fmt(detail.interest_remaining)}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-100 p-3 dark:border-white/5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-app-muted">
          Outstanding balance over time
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              tickFormatter={(v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
              width={48}
            />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="balance" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-app-muted">Amortization schedule</p>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 dark:border-white/5">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-app-surface">
              <tr className="text-left text-gray-500 dark:text-app-muted">
                <th className="px-2 py-2 font-medium">Month</th>
                <th className="px-2 py-2 font-medium">EMI</th>
                <th className="px-2 py-2 font-medium">Principal</th>
                <th className="px-2 py-2 font-medium">Interest</th>
                <th className="px-2 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {detail.schedule.map((m, i) => {
                const isCurrent = i === currentMonthIndex;
                const zebra = i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-gray-50/60 dark:bg-white/[0.02]";
                const rowClass = isCurrent
                  ? "bg-cyan-50 font-medium text-gray-900 dark:bg-cyan-500/10 dark:text-white"
                  : m.paid
                    ? `text-gray-400 dark:text-app-muted ${zebra}`
                    : `text-gray-700 dark:text-app-subtle ${zebra}`;
                return (
                  <tr key={m.month} className={rowClass}>
                    <td className="px-2 py-1.5">{monthLabel(m.date)}</td>
                    <td className="px-2 py-1.5">{fmt(m.emi)}</td>
                    <td className="px-2 py-1.5">{fmt(m.principal_component)}</td>
                    <td className="px-2 py-1.5">{fmt(m.interest_component)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(m.outstanding_balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-100 p-3 dark:border-white/5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-app-muted">Add prepayment</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="0.01"
            value={prepayAmount}
            onChange={(e) => setPrepayAmount(e.target.value)}
            placeholder="e.g. 100000"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={onPrepay}
            disabled={prepaySaving || !prepayAmount || Number(prepayAmount) <= 0}
            className={`${btnPrimary} flex-shrink-0`}
          >
            {prepaySaving ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onMarkClosed}
        disabled={closing}
        className="w-full rounded-xl border border-red-400/40 text-red-400 text-sm py-2.5 hover:bg-red-400/10 transition-colors disabled:opacity-50"
      >
        {closing ? "Closing…" : "Mark as Closed"}
      </button>
    </div>
  );
}

export default function EMI() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [prepayAmount, setPrepayAmount] = useState("");
  const [prepaySaving, setPrepaySaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const refetchAll = useCallback(async () => {
    try {
      const [loansRes, summaryRes] = await Promise.all([API.get("/emi"), API.get("/emi/summary")]);
      setLoans(Array.isArray(loansRes.data) ? loansRes.data : []);
      setSummary(summaryRes.data || null);
    } catch {
      // keep whatever we already had rather than blanking the page
    }
  }, []);

  useEffect(() => {
    refetchAll().finally(() => setLoading(false));
  }, [refetchAll]);

  const openDetail = useCallback(
    async (id) => {
      setSelectedId(id);
      setDetail(null);
      setDetailLoading(true);
      try {
        const res = await API.get(`/emi/${id}`);
        setDetail(res.data);
      } catch {
        showToast("Could not load loan details", "error");
      } finally {
        setDetailLoading(false);
      }
    },
    [showToast]
  );

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setPrepayAmount("");
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeDetail]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.post("/emi", {
        name: form.name,
        loan_type: form.loan_type,
        principal: parseFloat(form.principal),
        interest_rate: parseFloat(form.interest_rate),
        tenure_months: parseInt(form.tenure_months, 10),
        start_date: form.start_date,
        emi_amount: form.emi_amount ? parseFloat(form.emi_amount) : null,
      });
      setModalOpen(false);
      setForm(emptyForm);
      showToast("Loan added", "success");
      await refetchAll();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || "Could not add loan";
      showToast(typeof msg === "string" ? msg : "Could not add loan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePrepay = async () => {
    if (!selectedId || !prepayAmount || Number(prepayAmount) <= 0) return;
    setPrepaySaving(true);
    try {
      await API.put(`/emi/${selectedId}`, { add_extra_payment: parseFloat(prepayAmount) });
      setPrepayAmount("");
      showToast("Prepayment applied", "success");
      await Promise.all([openDetail(selectedId), refetchAll()]);
    } catch {
      showToast("Could not apply prepayment", "error");
    } finally {
      setPrepaySaving(false);
    }
  };

  const handleMarkClosed = async () => {
    if (!selectedId) return;
    setClosing(true);
    try {
      await API.delete(`/emi/${selectedId}`);
      showToast("Loan marked as closed", "success");
      closeDetail();
      await refetchAll();
    } catch {
      showToast("Could not close loan", "error");
    } finally {
      setClosing(false);
    }
  };

  const activeLoans = loans.filter((l) => l.is_active);
  const closedLoans = loans.filter((l) => !l.is_active);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4 p-4">
        <div className="h-7 w-64 rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">EMI &amp; Debt Tracker</h2>
          <p className="mt-1 text-sm text-app-muted">
            Track loans and EMIs with a reducing-balance amortization schedule.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`${btnPrimary} inline-flex flex-shrink-0 items-center gap-1.5`}
        >
          <Plus className="h-4 w-4" /> Add New Loan
        </button>
      </div>

      {summary && activeLoans.length > 0 && (
        <div className="mb-5 grid grid-cols-4 gap-4">
          <SummaryCard label="Total Monthly EMI" value={fmt(summary.total_monthly_emi)} border="border-l-red-400" />
          <SummaryCard label="Total Outstanding" value={fmt(summary.total_outstanding)} border="border-l-red-500" />
          <SummaryCard
            label="Total Interest Remaining"
            value={fmt(summary.total_interest_remaining)}
            border="border-l-amber-500"
          />
          <SummaryCard label="Debt-Free Date" value={monthLabel(summary.debt_free_date)} border="border-l-amber-400" />
        </div>
      )}

      {activeLoans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans tracked yet"
          description="Add your first loan or EMI to see outstanding balances, interest, and a payoff schedule."
          actionLabel="Add New Loan"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activeLoans.map((loan, idx) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              idx={idx}
              selected={selectedId === loan.id}
              onClick={() => (selectedId === loan.id ? closeDetail() : openDetail(loan.id))}
            />
          ))}
        </div>
      )}

      {closedLoans.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-app-muted">Closed Loans</p>
          <div className="flex flex-col gap-2">
            {closedLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 opacity-60 dark:border-white/5 dark:bg-app-card"
              >
                <span className="text-sm text-gray-700 dark:text-app-subtle">{loan.name}</span>
                <span className="text-xs text-gray-500 dark:text-app-muted">Closed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Add New Loan"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="emi-form" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save loan"}
            </button>
          </>
        }
      >
        <form id="emi-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldClass}
              placeholder="e.g. Home Loan HDFC"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Loan Type</label>
            <select
              required
              value={form.loan_type}
              onChange={(e) => setForm((f) => ({ ...f, loan_type: e.target.value }))}
              className={fieldClass}
            >
              {LOAN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
                Principal Amount (₹)
              </label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={form.principal}
                onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
                className={fieldClass}
                placeholder="e.g. 3000000"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
                Annual Interest Rate (%)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))}
                className={fieldClass}
                placeholder="Home: ~8-9%, Car: ~9-11%, Personal: ~12-18%, Education: ~8-12%"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
                Tenure (months)
              </label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={form.tenure_months}
                onChange={(e) => setForm((f) => ({ ...f, tenure_months: e.target.value }))}
                className={fieldClass}
                placeholder="e.g. 240"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
                Start Date
              </label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
              EMI Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.emi_amount}
              onChange={(e) => setForm((f) => ({ ...f, emi_amount: e.target.value }))}
              className={fieldClass}
              placeholder="Leave blank to auto-calculate"
            />
          </div>
        </form>
      </Modal>

      <AnimatePresence>
        {selectedId && (
          <>
            <motion.div
              onClick={closeDetail}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-app-card"
            >
              <LoanDetailPanel
                detail={detail}
                loading={detailLoading}
                onClose={closeDetail}
                prepayAmount={prepayAmount}
                setPrepayAmount={setPrepayAmount}
                onPrepay={handlePrepay}
                prepaySaving={prepaySaving}
                onMarkClosed={handleMarkClosed}
                closing={closing}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
