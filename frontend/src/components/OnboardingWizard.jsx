import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Upload, PlusCircle, ArrowRight } from "lucide-react";
import API from "../api/axios";
import { currentMonthParam } from "../utils/month";

export const ONBOARDING_PROGRESS_KEY = "finpulse_onboarding_progress";

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(next) {
  try {
    localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — progress just won't persist across a refresh
  }
}

const SUGGESTED_CATEGORIES = [
  { key: "rent", label: "Rent", pct: 0.30 },
  { key: "food", label: "Food", pct: 0.15 },
  { key: "shopping", label: "Shopping", pct: 0.10 },
  { key: "transport", label: "Transport", pct: 0.08 },
];

function roundTo500(n) {
  return Math.round(n / 500) * 500;
}

const fadeStep = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.25 },
};

function ProgressDots({ current }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded-full ${
            n <= current ? "bg-app-accent" : "bg-gray-200 dark:bg-white/10"
          }`}
        />
      ))}
      <span className="ml-2 flex-shrink-0 text-xs text-app-muted">Step {current} of 3</span>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-7 pr-3 text-sm text-gray-900 outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 dark:border-white/10 dark:bg-app-surface dark:text-white disabled:opacity-40";

export default function OnboardingWizard({ onComplete }) {
  const navigate = useNavigate();
  const finishedRef = useRef(false);

  const initialProgress = loadProgress();
  const [step, setStep] = useState(
    !initialProgress.step1 ? 1 : !initialProgress.step2 ? 2 : !initialProgress.step3 ? 3 : 4
  );

  // ── Step 1: income ───────────────────────────────────────
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [savingIncome, setSavingIncome] = useState(false);
  const [enteredIncomeAmount, setEnteredIncomeAmount] = useState(0);

  // ── Step 3: budgets ──────────────────────────────────────
  const [budgetChecks, setBudgetChecks] = useState({
    rent: true, food: true, shopping: true, transport: true,
  });
  const [budgetAmounts, setBudgetAmounts] = useState({});
  const [savingBudgets, setSavingBudgets] = useState(false);

  const applySuggestions = (income) => {
    const next = {};
    for (const c of SUGGESTED_CATEGORIES) next[c.key] = roundTo500(income * c.pct);
    setBudgetAmounts(next);
  };

  useEffect(() => {
    if (enteredIncomeAmount > 0) applySuggestions(enteredIncomeAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredIncomeAmount]);

  // Landing on step 3 directly (e.g. after a refresh, income already saved in
  // a prior visit) — fetch this month's income so suggestions aren't blank.
  useEffect(() => {
    if (step !== 3 || enteredIncomeAmount > 0) return;
    (async () => {
      try {
        const res = await API.get(`/income/${currentMonthParam()}/`);
        const amt = Number(res.data?.amount || 0);
        if (amt > 0) applySuggestions(amt);
      } catch {
        // no income on record — suggested amounts stay 0, user can edit
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const markStep = (n, status) => saveProgress({ ...loadProgress(), [`step${n}`]: status });

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    saveProgress({ ...loadProgress(), dismissed: true });
    onComplete?.();
  };

  // Step 4 auto-advances after a short pause; also reachable via the button.
  useEffect(() => {
    if (step !== 4) return;
    const t = setTimeout(finish, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Step 1 handlers ──────────────────────────────────────
  const handleIncomeNext = async () => {
    const amt = Number(incomeAmount);
    if (!amt || amt <= 0) return;
    setSavingIncome(true);
    try {
      await API.post("/income/", {
        month: currentMonthParam(),
        amount: amt,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? "monthly" : null,
      });
      setEnteredIncomeAmount(amt);
      markStep(1, "done");
      setStep(2);
    } catch {
      // stay on step 1 so the user can retry
    } finally {
      setSavingIncome(false);
    }
  };
  const handleIncomeSkip = () => {
    markStep(1, "skipped");
    setStep(2);
  };

  // ── Step 2 handlers ──────────────────────────────────────
  const handleImportChoice = () => {
    markStep(2, "done");
    navigate("/money/import");
  };
  const handleManualChoice = () => {
    markStep(2, "done");
    navigate("/expenses?focus=add");
  };
  const handleExpenseSkip = () => {
    markStep(2, "skipped");
    setStep(3);
  };

  // ── Step 3 handlers ──────────────────────────────────────
  const handleFinishSetup = async () => {
    setSavingBudgets(true);
    try {
      const toCreate = SUGGESTED_CATEGORIES.filter(
        (c) => budgetChecks[c.key] && Number(budgetAmounts[c.key] || 0) > 0
      );
      await Promise.all(
        toCreate.map((c) =>
          API.post("/budgets/", {
            category: c.key,
            amount: Number(budgetAmounts[c.key]),
            month: currentMonthParam(),
          }).catch(() => null)
        )
      );
      markStep(3, "done");
      setStep(4);
    } finally {
      setSavingBudgets(false);
    }
  };
  const handleBudgetSkip = () => {
    markStep(3, "skipped");
    setStep(4);
  };

  return (
    <div className="mx-auto max-w-lg py-10">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" {...fadeStep}>
            <ProgressDots current={1} />
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              What's your monthly income?
            </h2>
            <p className="mt-1 text-sm text-app-muted">
              Let's start by knowing what you earn. This helps FinPulse calculate your savings and
              safe-to-spend amount.
            </p>

            <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 dark:border-white/5 dark:bg-app-card">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-app-subtle">
                Monthly income
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-app-muted">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  placeholder="e.g. 72,000"
                  className={INPUT_CLASS}
                />
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-app-subtle">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 accent-app-accent"
                />
                This is my regular monthly salary
              </label>

              <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-app-subtle">
                Source <span className="font-normal text-app-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={incomeSource}
                onChange={(e) => setIncomeSource(e.target.value)}
                placeholder="e.g. Salary - TCS"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 dark:border-white/10 dark:bg-app-surface dark:text-white"
              />

              <button
                type="button"
                onClick={handleIncomeNext}
                disabled={!incomeAmount || Number(incomeAmount) <= 0 || savingIncome}
                className="mt-5 w-full rounded-xl bg-app-accent py-2.5 text-sm font-semibold text-white transition hover:bg-app-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingIncome ? "Saving…" : "Next"}
              </button>
              <button
                type="button"
                onClick={handleIncomeSkip}
                className="mt-2 w-full text-center text-xs text-app-muted transition hover:text-gray-700 dark:hover:text-white"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" {...fadeStep}>
            <ProgressDots current={2} />
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              How do you want to add expenses?
            </h2>
            <p className="mt-1 text-sm text-app-muted">
              FinPulse works best with real transaction data. Pick how you'd like to add your first
              expenses.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleImportChoice}
                className="flex flex-col items-start gap-2 rounded-2xl border border-gray-100 bg-white p-5 text-left transition hover:border-app-accent/40 dark:border-white/5 dark:bg-app-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-500/10">
                  <Upload className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Import bank statement
                </p>
                <p className="text-xs text-app-muted">
                  Upload a CSV from ICICI, HDFC, SBI, or any bank. We'll categorize everything
                  automatically.
                </p>
              </button>

              <button
                type="button"
                onClick={handleManualChoice}
                className="flex flex-col items-start gap-2 rounded-2xl border border-gray-100 bg-white p-5 text-left transition hover:border-app-accent/40 dark:border-white/5 dark:bg-app-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
                  <PlusCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Add manually</p>
                <p className="text-xs text-app-muted">
                  Type, speak, or scan a receipt. Best for tracking day-to-day spending.
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExpenseSkip}
              className="mt-4 w-full text-center text-xs text-app-muted transition hover:text-gray-700 dark:hover:text-white"
            >
              Skip
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" {...fadeStep}>
            <ProgressDots current={3} />
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Set your first budget
            </h2>
            <p className="mt-1 text-sm text-app-muted">
              Budgets help FinPulse track your spending and alert you before you overspend. Here are
              some suggested starting points based on your income.
            </p>

            <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 dark:border-white/5 dark:bg-app-card">
              <div className="space-y-3">
                {SUGGESTED_CATEGORIES.map((c) => (
                  <div key={c.key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!budgetChecks[c.key]}
                      onChange={(e) =>
                        setBudgetChecks((p) => ({ ...p, [c.key]: e.target.checked }))
                      }
                      className="h-4 w-4 flex-shrink-0 accent-app-accent"
                    />
                    <span className="w-24 flex-shrink-0 text-sm text-gray-700 dark:text-app-subtle">
                      {c.label}
                    </span>
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-app-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={budgetAmounts[c.key] ?? ""}
                        onChange={(e) =>
                          setBudgetAmounts((p) => ({ ...p, [c.key]: e.target.value }))
                        }
                        disabled={!budgetChecks[c.key]}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={savingBudgets}
                className="mt-5 w-full rounded-xl bg-app-accent py-2.5 text-sm font-semibold text-white transition hover:bg-app-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingBudgets ? "Saving…" : "Finish Setup"}
              </button>
              <button
                type="button"
                onClick={handleBudgetSkip}
                className="mt-2 w-full text-center text-xs text-app-muted transition hover:text-gray-700 dark:hover:text-white"
              >
                Skip — I'll set budgets later
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-10 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            >
              <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden />
            </motion.div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              You're all set!
            </h2>
            <p className="mt-1 text-sm text-app-muted">Taking you to your Dashboard…</p>
            <button
              type="button"
              onClick={finish}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-app-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-app-accent/90"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
