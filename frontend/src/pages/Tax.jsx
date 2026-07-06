import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  PiggyBank,
  TrendingUp,
  FileText,
  Shield,
  Building2,
  Lock,
  Users,
  Heart,
  Home,
  GraduationCap,
  Landmark,
  HeartPulse,
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import API from "../api/axios";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useToast } from "../components/ToastProvider";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

const CARD = "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card";
const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:placeholder:text-app-muted dark:focus:border-cyan-500/40";
const btnPrimary =
  "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 disabled:opacity-50";
const btnSecondary =
  "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-subtle dark:hover:bg-white/5 dark:hover:text-white";

const INSTRUMENT_ICON = {
  PPF: PiggyBank,
  ELSS: TrendingUp,
  NSC: FileText,
  LIC: Shield,
  EPF: Building2,
  VPF: Building2,
  FD_5yr: Lock,
  SCSS: Users,
  SSY: Heart,
  Home_Loan_Principal: Home,
  Tuition_Fees: GraduationCap,
  NPS_80CCD: Landmark,
  Health_Insurance_Self_80D: HeartPulse,
  Health_Insurance_Parents_80D: HeartPulse,
};

const INSTRUMENT_OPTIONS = [
  { value: "PPF", label: "PPF (Public Provident Fund)" },
  { value: "ELSS", label: "ELSS Mutual Fund" },
  { value: "NSC", label: "NSC (National Savings Certificate)" },
  { value: "LIC", label: "LIC / Life Insurance Premium" },
  { value: "EPF", label: "EPF (Employee Provident Fund)" },
  { value: "VPF", label: "VPF (Voluntary Provident Fund)" },
  { value: "FD_5yr", label: "5-Year Tax-Saving FD" },
  { value: "SCSS", label: "SCSS (Senior Citizens Savings Scheme)" },
  { value: "SSY", label: "SSY (Sukanya Samriddhi Yojana)" },
  { value: "Home_Loan_Principal", label: "Home Loan Principal Repayment" },
  { value: "Tuition_Fees", label: "Children's Tuition Fees" },
  { value: "NPS_80CCD", label: "NPS — Additional 80CCD(1B)" },
  { value: "Health_Insurance_Self_80D", label: "Health Insurance — Self / Family" },
  { value: "Health_Insurance_Parents_80D", label: "Health Insurance — Parents" },
];
const INSTRUMENT_LABEL = Object.fromEntries(INSTRUMENT_OPTIONS.map((o) => [o.value, o.label]));

const FREQUENCY_LABEL = { one_time: "One-time", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

function fmt(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function fyLabel(fy) {
  return fy ? `FY ${fy}` : "";
}

// Mirrors backend/app/services/tax_service.py's get_financial_year() (FY
// starts April 1) — keep these two in sync if the FY rule ever changes.
// getMonth() is 0-indexed, so >= 3 means April onward.
function currentFYStartYear() {
  const today = new Date();
  return today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
}

function fyString(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function fyOptionsList(count = 4) {
  const start = currentFYStartYear();
  return Array.from({ length: count }, (_, i) => fyString(start - i));
}

function sectionTone(pct) {
  if (pct >= 100) return "safe";
  if (pct >= 80) return "warn";
  return "teal";
}

function section80cExtraLine(remaining, monthsRemaining, perMonthNeeded) {
  if (remaining <= 0) return "Limit fully utilized for this financial year.";
  if (monthsRemaining <= 0) return null;
  const monthWord = monthsRemaining === 1 ? "month" : "months";
  return `${fmt(remaining)} remaining — invest ${fmt(perMonthNeeded)}/month for ${monthsRemaining} ${monthWord} to max out.`;
}

function section80ccdExtraLine(remaining) {
  if (remaining <= 0) return "Limit fully utilized for this financial year.";
  return `${fmt(remaining)} remaining of the extra ₹50,000 NPS limit (separate from 80C).`;
}

function formatDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const emptyForm = { instrument_type: "PPF", name: "", amount: "", frequency: "one_time", date: "" };

function SectionProgress({ title, invested, limit, pct, extraLine }) {
  return (
    <div className={CARD}>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-app-muted">
          {fmt(invested)} of {fmt(limit)} utilized
        </p>
      </div>
      <ProgressBar pct={pct} tone={sectionTone(pct)} />
      {extraLine && <p className="mt-2 text-xs text-gray-500 dark:text-app-muted">{extraLine}</p>}
    </div>
  );
}

function InvestmentRow({ inv, onEdit, onDelete }) {
  const Icon = INSTRUMENT_ICON[inv.instrument_type] || PiggyBank;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-white/5 dark:bg-app-card">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-500/10">
          <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{inv.name}</p>
          <p className="text-xs text-gray-500 dark:text-app-muted">
            {INSTRUMENT_LABEL[inv.instrument_type] || inv.instrument_type} · {formatDate(inv.date)}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-white/10 dark:text-app-subtle">
          {FREQUENCY_LABEL[inv.frequency] || inv.frequency}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(inv.amount)}</span>
        <button
          type="button"
          onClick={() => onEdit(inv)}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 dark:text-app-muted dark:hover:bg-white/5 dark:hover:text-white"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(inv.id)}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:text-app-muted dark:hover:bg-red-500/10 dark:hover:text-red-400"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function RegimeCard({ title, result, recommended }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        recommended
          ? "border-emerald-300 bg-emerald-50/40 shadow-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-500/[0.06] dark:shadow-none"
          : "border-gray-100 bg-white dark:border-white/[0.05] dark:bg-app-card"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        {recommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Recommended
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{fmt(result.total_tax)}</p>
      <p className="text-xs text-gray-500 dark:text-app-muted">Total tax payable</p>
      <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs dark:border-white/5">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-app-muted">Taxable income</span>
          <span className="font-medium text-gray-900 dark:text-white">{fmt(result.taxable_income)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-app-muted">Effective tax rate</span>
          <span className="font-medium text-gray-900 dark:text-white">{result.effective_tax_rate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function Tax() {
  const { showToast } = useToast();
  const fyOptions = useMemo(() => fyOptionsList(4), []);
  const [fy, setFy] = useState(fyOptions[0]);

  const [incomeInput, setIncomeInput] = useState("");
  const [income, setIncome] = useState(null);

  const [grouped, setGrouped] = useState({ section_80c: [], section_80ccd: [], section_80d: [] });
  const [summary, setSummary] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Debounce raw income typing before it drives calculations/API calls.
  useEffect(() => {
    const t = setTimeout(() => {
      const n = parseFloat(incomeInput);
      setIncome(Number.isFinite(n) && n > 0 ? n : null);
    }, 450);
    return () => clearTimeout(t);
  }, [incomeInput]);

  // Guards against out-of-order responses: if the user changes fy/income
  // again before an in-flight request resolves, the older response's
  // result is discarded instead of overwriting newer state.
  const requestIdRef = useRef(0);

  const refetchAll = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const params = { fy };
      const [investRes, summaryRes] = await Promise.all([
        API.get("/tax/investments", { params }),
        API.get("/tax/summary", { params: income ? { ...params, annual_income: income } : params }),
      ]);
      if (requestIdRef.current !== requestId) return;
      setGrouped(investRes.data || { section_80c: [], section_80ccd: [], section_80d: [] });
      setSummary(summaryRes.data || null);

      if (income) {
        const compareRes = await API.get("/tax/compare", { params: { fy, annual_income: income } });
        if (requestIdRef.current !== requestId) return;
        setCompareData(compareRes.data || null);
      } else {
        setCompareData(null);
      }
    } catch {
      // keep whatever we already had
    }
  }, [fy, income]);

  useEffect(() => {
    setLoading(true);
    refetchAll().finally(() => setLoading(false));
  }, [refetchAll]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (inv) => {
    setEditingId(inv.id);
    setForm({
      instrument_type: inv.instrument_type,
      name: inv.name,
      amount: String(inv.amount),
      frequency: inv.frequency,
      date: inv.date,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        instrument_type: form.instrument_type,
        name: form.name,
        amount: parseFloat(form.amount),
        frequency: form.frequency,
        date: form.date,
      };
      if (editingId) {
        await API.put(`/tax/investments/${editingId}`, payload);
        showToast("Investment updated", "success");
      } else {
        await API.post("/tax/investments", payload);
        showToast("Investment added", "success");
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await refetchAll();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || "Could not save investment";
      showToast(typeof msg === "string" ? msg : "Could not save investment", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/tax/investments/${id}`);
      showToast("Investment deleted", "success");
      await refetchAll();
    } catch {
      showToast("Could not delete investment", "error");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4 p-4">
        <div className="h-7 w-64 rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-white/5" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  const totalInvestments =
    grouped.section_80c.length + grouped.section_80ccd.length + grouped.section_80d.length;
  const showIntro = totalInvestments === 0 && !income;

  const c80c = summary?.section_80c;
  const c80ccd = summary?.section_80ccd;
  const c80d = summary?.section_80d;
  const monthsRemaining = summary?.months_remaining_in_fy || 0;
  const perMonthNeeded = summary?.investment_needed_per_month_80c || 0;

  return (
    <div className="mx-auto max-w-4xl p-4">
      <motion.div {...fadeUp(0)} className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Planner</h2>
          <p className="mt-1 text-sm text-app-muted">
            Track 80C, 80CCD, and 80D deductions and compare the Old vs New tax regime.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <select value={fy} onChange={(e) => setFy(e.target.value)} className={`${fieldClass} w-auto`}>
            {fyOptions.map((f) => (
              <option key={f} value={f}>
                {fyLabel(f)}
              </option>
            ))}
          </select>
          <button type="button" onClick={openAddModal} className={`${btnPrimary} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" /> Add Investment
          </button>
        </div>
      </motion.div>

      {showIntro ? (
        <motion.div {...fadeUp(0.05)}>
          <EmptyState
            icon={Landmark}
            title="No tax data yet"
            description="Track your tax-saving investments under Section 80C, 80CCD, and 80D. Add your annual income and investments to see how much tax you can save — and whether the Old or New regime is better for you."
            actionLabel="Add Investment"
            onAction={openAddModal}
          />
        </motion.div>
      ) : (
        <>
          {/* Income + Regime Comparison */}
          <motion.div {...fadeUp(0.05)} className={`${CARD} mb-4`}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
              Your Annual Income (CTC)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-app-muted">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                placeholder="Enter your annual income to see tax comparison."
                className={`${fieldClass} pl-7`}
              />
            </div>

            {compareData && (
              <div className="mt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RegimeCard
                    title="Old Regime"
                    result={compareData.old_regime}
                    recommended={compareData.better_regime === "old"}
                  />
                  <RegimeCard
                    title="New Regime"
                    result={compareData.new_regime}
                    recommended={compareData.better_regime === "new"}
                  />
                </div>
                {compareData.better_regime !== "either" && (
                  <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    You save {fmt(compareData.difference)} with the {compareData.better_regime === "old" ? "Old" : "New"} Regime.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-app-muted">{compareData.recommendation}</p>
                <p className="mt-2 text-[11px] text-gray-400 dark:text-app-muted">
                  Note: the New Regime is the default — you must explicitly opt out each year to use the Old Regime.
                </p>
              </div>
            )}
          </motion.div>

          {/* 80C tracker */}
          {c80c && (
            <motion.div {...fadeUp(0.1)} className="mb-4">
              <SectionProgress
                title="Section 80C"
                invested={c80c.total_invested}
                limit={c80c.limit}
                pct={c80c.percentage_utilized}
                extraLine={section80cExtraLine(c80c.remaining_limit, monthsRemaining, perMonthNeeded)}
              />
              {grouped.section_80c.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {grouped.section_80c.map((inv) => (
                    <InvestmentRow key={inv.id} inv={inv} onEdit={openEditModal} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 80CCD tracker */}
          {c80ccd && (
            <motion.div {...fadeUp(0.15)} className="mb-4">
              <SectionProgress
                title="Section 80CCD(1B) — NPS"
                invested={c80ccd.total_invested}
                limit={c80ccd.limit}
                pct={c80ccd.percentage_utilized}
                extraLine={section80ccdExtraLine(c80ccd.remaining_limit)}
              />
              {grouped.section_80ccd.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {grouped.section_80ccd.map((inv) => (
                    <InvestmentRow key={inv.id} inv={inv} onEdit={openEditModal} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 80D tracker */}
          {c80d && (
            <motion.div {...fadeUp(0.2)} className="mb-4">
              <div className={CARD}>
                <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Section 80D — Health Insurance</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-gray-500 dark:text-app-muted">Self / Family</span>
                      <span className="text-gray-500 dark:text-app-muted">
                        {fmt(c80d.self_invested)} of {fmt(c80d.self_limit)}
                      </span>
                    </div>
                    <ProgressBar
                      pct={(c80d.self_invested / c80d.self_limit) * 100}
                      tone={sectionTone((c80d.self_invested / c80d.self_limit) * 100)}
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-gray-500 dark:text-app-muted">Parents</span>
                      <span className="text-gray-500 dark:text-app-muted">
                        {fmt(c80d.parents_invested)} of {fmt(c80d.parents_limit)}
                      </span>
                    </div>
                    <ProgressBar
                      pct={(c80d.parents_invested / c80d.parents_limit) * 100}
                      tone={sectionTone((c80d.parents_invested / c80d.parents_limit) * 100)}
                    />
                  </div>
                </div>
              </div>
              {grouped.section_80d.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {grouped.section_80d.map((inv) => (
                    <InvestmentRow key={inv.id} inv={inv} onEdit={openEditModal} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Tax saved estimate */}
          <motion.div {...fadeUp(0.25)} className={CARD}>
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Tax Saved Estimate</p>
            {summary?.tax_saved ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-app-muted">80C saves</p>
                  <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmt(summary.tax_saved.section_80c)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-app-muted">80CCD saves</p>
                  <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmt(summary.tax_saved.section_80ccd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-app-muted">80D saves</p>
                  <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmt(summary.tax_saved.section_80d)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-app-muted">Total tax saved</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {fmt(summary.tax_saved.total)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-app-muted">
                Enter your annual income above to see your tax savings, calculated at your slab rate under the Old Regime.
              </p>
            )}
          </motion.div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "Edit Investment" : "Add Investment"}
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="tax-form" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="tax-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Instrument Type</label>
            <select
              required
              value={form.instrument_type}
              onChange={(e) => setForm((f) => ({ ...f, instrument_type: e.target.value }))}
              className={fieldClass}
            >
              {INSTRUMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldClass}
              placeholder="e.g. Axis ELSS Fund SIP"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Amount (₹)</label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={fieldClass}
                placeholder="e.g. 50000"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Frequency</label>
              <select
                required
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                className={fieldClass}
              >
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Date</label>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={fieldClass}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
