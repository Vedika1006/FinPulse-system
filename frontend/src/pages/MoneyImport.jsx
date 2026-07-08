import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Landmark, ChevronLeft, Upload, CheckCircle, Wallet, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { previewCSVImport, confirmCSVImport } from "../api/imports";
import { listIncome, saveIncome, deleteIncome } from "../api/income";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ToastProvider";
import { currentMonthParam } from "../utils/month";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay },
});

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 dark:border-white/[0.08] dark:bg-app-surface dark:text-white dark:placeholder:text-app-muted dark:focus:border-app-accent/40";
const btnPrimaryCls =
  "rounded-xl bg-app-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-app-accent/90 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryCls =
  "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-transparent dark:text-app-subtle dark:hover:bg-white/5 dark:hover:text-white";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// ── "Your Income" section — manual income entry, separate from the CSV
// import flow below it. Income is one record per month (upsert keyed by
// month on the backend), so this list always shows 0 or 1 card for the
// current month — "Edit" re-saves the same month's record.
function IncomeSection() {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentMonth = currentMonthParam();
  const currentMonthLabel = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listIncome();
      setRecords((Array.isArray(all) ? all : []).filter((r) => r.month === currentMonth));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const openAdd = () => {
    setEditing(null);
    setAmount("");
    setDescription("");
    setDate(todayISODate());
    setRecurring(false);
    setFormOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setAmount(String(record.amount ?? ""));
    setDescription(record.description || "");
    setDate(record.date ? record.date.slice(0, 10) : todayISODate());
    setRecurring(Boolean(record.is_recurring));
    setFormOpen(true);
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !description.trim() || !date) return;
    setSaving(true);
    try {
      await saveIncome({
        month: date.slice(0, 7),
        amount: amt,
        description: description.trim(),
        date: new Date(date).toISOString(),
        is_recurring: recurring,
        recurring_frequency: recurring ? "monthly" : null,
      });
      showToast(editing ? "Income updated" : "Income added", "success");
      setFormOpen(false);
      await refetch();
    } catch {
      showToast("Could not save income. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    const ok = window.confirm(
      `Delete this income record (₹${Number(record.amount).toLocaleString("en-IN")})?`
    );
    if (!ok) return;
    try {
      await deleteIncome(record.id);
      showToast("Income deleted", "success");
      await refetch();
    } catch {
      showToast("Could not delete income", "error");
    }
  };

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-app-accent" aria-hidden />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Your Income</h3>
        </div>
        <button type="button" onClick={openAdd} className={`${btnPrimaryCls} inline-flex items-center gap-1.5`}>
          <Plus className="h-4 w-4" /> Add Income
        </button>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
      ) : records.length === 0 ? (
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/5">
          <p className="text-sm text-app-muted">
            No income recorded for {currentMonthLabel}. Add your salary to get accurate savings and
            safe-to-spend calculations.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r, i) => (
            <motion.div
              key={r.id}
              {...fadeUp(i * 0.05)}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-white/5 dark:bg-app-card"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {r.description || "Income"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-app-muted">
                    {r.date
                      ? new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : currentMonthLabel}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {r.is_recurring && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-app-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-accent">
                    <RefreshCw className="h-2.5 w-2.5" aria-hidden /> Recurring
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  ₹{Number(r.amount).toLocaleString("en-IN")}
                </span>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 dark:text-app-muted dark:hover:bg-white/5 dark:hover:text-white"
                  aria-label="Edit income"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:text-app-muted dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  aria-label="Delete income"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? "Edit Income" : "Add Income"}
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className={btnSecondaryCls}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !amount || Number(amount) <= 0 || !description.trim() || !date}
              className={btnPrimaryCls}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-app-muted">
                ₹
              </span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 72,000"
                className={`${fieldClass} pl-7`}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
              Source / Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly Salary - TCS"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-app-subtle">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 accent-app-accent"
            />
            This repeats every month
          </label>
          {recurring && (
            <p className="text-xs text-app-muted">
              This income will automatically appear in future months. You can edit any month's amount
              individually.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

const BANKS = [
  { key: "icici", label: "ICICI Bank",  color: "text-orange-500" },
  { key: "hdfc",  label: "HDFC Bank",   color: "text-blue-600"   },
  { key: "sbi",   label: "SBI",         color: "text-indigo-500" },
  { key: "other", label: "Other Bank",  color: "text-gray-500 dark:text-app-muted" },
];

const INSTRUCTIONS = {
  icici: [
    "Log into ICICI Bank Net Banking.",
    "Go to Accounts → Download Account Statement.",
    "Select your account and choose a date range (last 1–3 months works well).",
    <>Choose <strong className="text-gray-900 dark:text-white">CSV</strong> as the format.</>,
    "Download the file to your computer.",
  ],
  hdfc: [
    "Log into HDFC Bank NetBanking or open the HDFC Mobile Banking app.",
    "On the app: go to Accounts → Statement → Download, choose CSV format.",
    "On NetBanking: go to Accounts → Account Statement, choose your date range — note that NetBanking offers PDF, Excel or Text; for CSV use the mobile app.",
    "Download the file to your computer.",
  ],
  sbi: [
    "Log into SBI YONO app or Online SBI.",
    "Go to Accounts → Download Account Statement.",
    "Select your date range and choose Excel format (SBI doesn't offer direct CSV).",
    "Open the downloaded Excel file and use File → Save As → CSV (Comma delimited).",
    "Upload that converted CSV file below.",
  ],
  other: [
    "Download your bank statement as CSV or Excel from your bank's net banking portal.",
    "If you only have Excel, open it and use File → Save As → CSV format.",
    "Make sure the file includes columns for date, transaction description, and amount.",
    "Upload the file below — we'll try to automatically detect the right columns.",
  ],
};

export default function MoneyImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentStep, setCurrentStep] = useState("select-bank");
  const [selectedBank, setSelectedBank] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [checkedTxns, setCheckedTxns] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const setStep = (step) => setCurrentStep(step);

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const data = await previewCSVImport(file, selectedBank);
      setPreviewData(data);
      setCheckedTxns(data.transactions.map((t) => !t.is_duplicate));
      setStep("review");
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        "Failed to parse the file. Please check the format and try again.";
      setUploadError(detail);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── Confirm import ────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!previewData) return;
    const selected = previewData.transactions.filter((_, i) => checkedTxns[i]);
    try {
      const result = await confirmCSVImport(selected, previewData.income_entries || [], false);
      localStorage.removeItem("finpulse_weekly_action");

      // The confirm endpoint only returns counts, not amounts/categories/date
      // range — compute those client-side from what was actually confirmed,
      // while previewData is still around.
      const incomeEntries = previewData.income_entries || [];
      const totalExpenseAmount = selected.reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalIncomeAmount = incomeEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

      const allDates = [...selected.map((t) => t.date), ...incomeEntries.map((e) => e.date)]
        .filter(Boolean)
        .map((d) => new Date(d))
        .filter((d) => !isNaN(d));
      let dateRangeLabel = null;
      if (allDates.length > 0) {
        const fmt = (d) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        const minLabel = fmt(new Date(Math.min(...allDates)));
        const maxLabel = fmt(new Date(Math.max(...allDates)));
        dateRangeLabel = minLabel === maxLabel ? minLabel : `${minLabel} — ${maxLabel}`;
      }

      const categoryTotals = {};
      for (const t of selected) {
        const cat = String(t.category || t.suggested_category || "other").toLowerCase();
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount || 0);
      }
      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([category, amount]) => ({ category, amount }));

      setImportSummary({
        totalExpenseAmount,
        totalIncomeAmount,
        dateRangeLabel,
        topCategories,
        duplicatesFlagged: previewData.duplicate_count || 0,
      });
      setImportResult(result);
      setStep("done");
    } catch {
      setUploadError("Import failed. Please try again.");
    }
  };

  const selectedCount = checkedTxns.filter(Boolean).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Page header — always visible */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Income & Import</h2>
        <p className="text-sm text-app-muted mt-1">
          Track what you earn and bring your spending history into FinPulse.
        </p>
      </div>

      <IncomeSection />

      <div className="mb-1 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-app-accent" aria-hidden />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Import Bank Statement</h3>
        </div>
        <div className="h-px flex-1 bg-gray-100 dark:bg-white/5" />
      </div>
      <p className="mb-6 text-sm text-app-muted">
        Import transactions from your bank statement and we&apos;ll organise it automatically.
      </p>

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Bank selection ────────────────────────────────────────── */}
        {currentStep === "select-bank" && (
          <motion.div key="select-bank" {...fadeUp(0)}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BANKS.map((bank) => (
                <button
                  key={bank.key}
                  onClick={() => {
                    setSelectedBank(bank.key);
                    setStep("instructions");
                  }}
                  className="flex flex-col items-center gap-2 bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-xl p-4 cursor-pointer hover:border-app-accent/40 transition-colors text-center"
                >
                  <Landmark className={`w-7 h-7 ${bank.color}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {bank.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Instructions ─────────────────────────────────────────── */}
        {currentStep === "instructions" && (
          <motion.div key="instructions" {...fadeUp(0)}>
            <button
              onClick={() => setStep("select-bank")}
              className="text-xs text-app-muted mb-4 flex items-center gap-1 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Change bank
            </button>

            {/* Benefits callout */}
            <div className="bg-app-accent/5 border border-app-accent/15 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Why import your statement?
              </p>
              <ul className="text-xs text-app-muted space-y-1.5">
                <li>• Add months of expense history in seconds instead of typing each one</li>
                <li>• FinPulse automatically categorises every transaction using AI</li>
                <li>• Duplicate payments are flagged before they&apos;re added</li>
                <li>• Your forecasts and insights get more accurate with more data</li>
              </ul>
            </div>

            {/* Bank-specific instructions */}
            <div className="bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                How to get your{" "}
                {BANKS.find((b) => b.key === selectedBank)?.label} statement as CSV
              </p>
              <ol className="text-sm text-gray-600 dark:text-app-muted space-y-2 list-decimal list-inside">
                {(INSTRUCTIONS[selectedBank] || INSTRUCTIONS.other).map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <button
              onClick={() => setStep("upload")}
              className="w-full bg-app-accent text-white rounded-xl py-2.5 text-sm font-medium hover:bg-app-accent/90 transition-colors"
            >
              Continue to upload
            </button>
          </motion.div>
        )}

        {/* ── STEP 3: Upload ───────────────────────────────────────────────── */}
        {currentStep === "upload" && (
          <motion.div key="upload" {...fadeUp(0)}>
            <button
              onClick={() => setStep("instructions")}
              className="text-xs text-app-muted mb-4 flex items-center gap-1 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Back to instructions
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFileInput}
            />

            {/* Drop zone */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-app-accent bg-app-accent/5"
                  : "border-gray-200 dark:border-white/10 hover:border-app-accent/40"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              {uploading ? (
                <>
                  <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    Reading your statement&hellip;
                  </p>
                  <p className="text-xs text-app-muted mt-1">
                    Detecting duplicates and categorising transactions
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-app-muted mx-auto mb-3" />
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    Drop your CSV file here
                  </p>
                  <p className="text-xs text-app-muted mt-1">or click to browse</p>
                </>
              )}
            </div>

            {/* Error message */}
            {uploadError && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-400/20 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                {uploadError}
              </div>
            )}
          </motion.div>
        )}

        {/* ── STEP 4: Review ───────────────────────────────────────────────── */}
        {currentStep === "review" && previewData && (
          <motion.div key="review" {...fadeUp(0)}>
            {/* Summary banner */}
            <div className="bg-app-accent/5 border border-app-accent/15 rounded-xl p-3 mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-900 dark:text-white">
                <span className="font-medium">{previewData.total_found}</span> transactions
                found
                {previewData.duplicate_count > 0 && (
                  <span className="text-app-muted">
                    {" "}· {previewData.duplicate_count} possible{" "}
                    {previewData.duplicate_count === 1 ? "duplicate" : "duplicates"}{" "}
                    unchecked
                  </span>
                )}
              </p>
              <button
                onClick={() => setStep("upload")}
                className="text-xs text-app-muted hover:text-gray-700 dark:hover:text-white transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> Re-upload
              </button>
            </div>

            {/* Transaction list */}
            <div className="max-h-72 overflow-y-auto flex flex-col gap-2 mb-3 pr-1">
              {previewData.transactions.map((txn, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-lg p-3"
                >
                  <input
                    type="checkbox"
                    checked={checkedTxns[i] ?? false}
                    onChange={(e) => {
                      const next = [...checkedTxns];
                      next[i] = e.target.checked;
                      setCheckedTxns(next);
                    }}
                    className="w-4 h-4 accent-cyan-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {txn.description}
                    </p>
                    <p className="text-xs text-app-muted">
                      {txn.date} · {txn.suggested_category}
                    </p>
                  </div>
                  <p className="text-sm font-mono text-gray-900 dark:text-white flex-shrink-0">
                    ₹{Number(txn.amount).toLocaleString("en-IN")}
                  </p>
                  {txn.is_duplicate && (
                    <span className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full flex-shrink-0">
                      Possible duplicate
                    </span>
                  )}
                </div>
              ))}

              {previewData.transactions.length === 0 && (
                <p className="text-sm text-app-muted text-center py-8">
                  No expense transactions found in this file.
                </p>
              )}
            </div>

            {/* Income credits section — shown when the bank CSV contains salary/credit entries */}
            {previewData.income_entries && previewData.income_entries.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                  {previewData.income_entries.length} income credit{previewData.income_entries.length !== 1 ? "s" : ""} detected — will be imported automatically
                </p>
                <div className="flex flex-col gap-1.5">
                  {previewData.income_entries.slice(0, 5).map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-500/15 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 dark:text-white truncate">{entry.description}</p>
                        <p className="text-xs text-gray-500 dark:text-app-muted">{entry.date}</p>
                      </div>
                      <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400 flex-shrink-0 ml-3">
                        +₹{Number(entry.amount).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                  {previewData.income_entries.length > 5 && (
                    <p className="text-xs text-app-muted text-center py-1">
                      +{previewData.income_entries.length - 5} more income entries
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action bar */}
            {(() => {
              const incomeCount = previewData.income_entries?.length ?? 0;
              const btnLabel =
                selectedCount > 0 && incomeCount > 0
                  ? `Import ${selectedCount} transaction${selectedCount !== 1 ? "s" : ""} + income`
                  : selectedCount > 0
                  ? `Import ${selectedCount} transaction${selectedCount !== 1 ? "s" : ""}`
                  : incomeCount > 0
                  ? `Import ${incomeCount} income entr${incomeCount !== 1 ? "ies" : "y"}`
                  : "Nothing selected";
              return (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                  <p className="text-xs text-app-muted">
                    {selectedCount} of {previewData.total_found} expenses selected
                    {incomeCount > 0 && ` · ${incomeCount} income credit${incomeCount !== 1 ? "s" : ""}`}
                  </p>
                  <button
                    onClick={handleConfirm}
                    disabled={selectedCount === 0 && incomeCount === 0}
                    className="bg-app-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {btnLabel}
                  </button>
                </div>
              );
            })()}

            {uploadError && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-400/20 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                {uploadError}
              </div>
            )}
          </motion.div>
        )}

        {/* ── STEP 5: Done ─────────────────────────────────────────────────── */}
        {currentStep === "done" && importResult && (
          <motion.div key="done" {...fadeUp(0)} className="py-6 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mb-3 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Import Complete ✓
            </h3>
            <p className="text-sm text-app-muted mb-5">
              Your expenses and forecasts have been updated.
            </p>

            {/* Primary stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-4">
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-500/15 bg-emerald-50 dark:bg-emerald-900/10 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Expenses imported
                </p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  {importResult.imported_count}
                </p>
                {importSummary?.totalExpenseAmount > 0 && (
                  <p className="text-xs text-app-muted mt-0.5">
                    ₹{importSummary.totalExpenseAmount.toLocaleString("en-IN")} total
                  </p>
                )}
              </div>

              {importSummary?.totalIncomeAmount > 0 && (
                <div className="rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-app-card p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
                    Income detected
                  </p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                    ₹{importSummary.totalIncomeAmount.toLocaleString("en-IN")}
                  </p>
                </div>
              )}

              {importSummary?.dateRangeLabel && (
                <div className="rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-app-card p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
                    Date range
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Across {importSummary.dateRangeLabel}
                  </p>
                </div>
              )}
            </div>

            {/* Category breakdown */}
            {importSummary?.topCategories?.length > 0 && (
              <p className="text-xs text-app-muted text-left mb-2">
                Top categories:{" "}
                {importSummary.topCategories
                  .map(
                    (c) =>
                      `${c.category.charAt(0).toUpperCase()}${c.category.slice(1)} (₹${c.amount.toLocaleString("en-IN")})`
                  )
                  .join(", ")}
              </p>
            )}

            {/* Duplicates note */}
            {importSummary?.duplicatesFlagged > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-left mb-2">
                {importSummary.duplicatesFlagged} possible duplicate
                {importSummary.duplicatesFlagged !== 1 ? "s" : ""} were flagged during review.
              </p>
            )}

            {importResult.income_imported > 0 && (
              <p className="text-xs text-app-muted text-left">
                Income set for {importResult.income_imported} new month
                {importResult.income_imported !== 1 ? "s" : ""}.
              </p>
            )}
            {importResult.income_merged > 0 && (
              <p className="text-xs text-app-muted text-left">
                Income added to {importResult.income_merged} existing month
                {importResult.income_merged !== 1 ? "s" : ""}.
              </p>
            )}
            {importResult.skipped_count > 0 && (
              <p className="text-xs text-app-muted text-left">
                {importResult.skipped_count} transaction
                {importResult.skipped_count !== 1 ? "s" : ""} skipped.
              </p>
            )}

            <div className="flex gap-3 mt-5 justify-center">
              <button
                onClick={() => {
                  setCurrentStep("select-bank");
                  setSelectedBank(null);
                  setPreviewData(null);
                  setCheckedTxns([]);
                  setImportResult(null);
                  setImportSummary(null);
                  setUploadError(null);
                }}
                className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-app-muted rounded-lg px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                Import Another
              </button>
              <button
                onClick={() => navigate("/expenses")}
                className="bg-app-accent text-white rounded-lg px-4 py-2 text-sm hover:bg-app-accent/90 transition-colors"
              >
                View Expenses →
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
