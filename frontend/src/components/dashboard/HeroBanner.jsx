import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowRight, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const healthColor = (score) => {
  if (score > 70) return "text-emerald-500";
  if (score > 40) return "text-amber-500";
  return "text-red-500";
};
const healthBarColor = (score) => {
  if (score > 70) return "bg-emerald-500";
  if (score > 40) return "bg-amber-500";
  return "bg-red-500";
};
const healthLabel = (score) => {
  if (score > 70) return "Good";
  if (score > 40) return "Fair";
  return "Needs attention";
};

const factorBarColor = (score) => {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
};

const fallbackHealthText = (score) => {
  if (score >= 80) return "Excellent — strong savings, budgets on track, consistent spending patterns.";
  if (score >= 60) return "Fair — you're doing okay but some spending areas need attention. Check your budget status.";
  if (score >= 40) return "Needs work — your spending is outpacing your plans. Review your top categories on the Analytics page.";
  return "Needs attention — consider reducing discretionary spending and setting tighter budgets.";
};

const HeroBanner = ({ displayName, health, healthDetail, cashflowPrediction, formatCurrency, income, totalExpenses, totalBudget, totalMonthlyEMI }) => {
  const navigate = useNavigate();
  const [showScoreExplainer, setShowScoreExplainer] = useState(false);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - today.getDate() + 1;
  const daysElapsedInMonth = today.getDate();
  const isEarlyEstimate = daysElapsedInMonth >= 5 && daysElapsedInMonth < 10;

  const totalIncome = income || 0;
  const emiBurden = totalMonthlyEMI || 0;
  // Reserved = what's set aside for the month (budget, or a 30% estimate if
  // no budget is set) — but never less than what's actually been spent,
  // since overspending the budget means that money is committed regardless —
  // plus the monthly EMI burden, since that money isn't available to spend
  // either even though it never becomes an Expense row (avoids double-
  // counting against imported bank statements that include the EMI debit).
  const usingBudgetFallback = !totalBudget || totalBudget <= 0;
  const reserved = Math.max(usingBudgetFallback ? totalIncome * 0.3 : totalBudget, totalExpenses || 0) + emiBurden;
  const availableToSpend = Math.max(totalIncome - reserved, 0);
  const safeToSpendPerDay = daysRemaining > 0 ? Math.round(availableToSpend / daysRemaining) : 0;

  const breakdown = healthDetail?.breakdown;
  const reasons = healthDetail?.reasons;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-app-ink">
            {getGreeting()}{displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">
            {cashflowPrediction == null ? (
              "Monthly projection available after a few more days of tracking"
            ) : cashflowPrediction > 0 ? (
              <>On track to spend{" "}
                <span className="font-semibold text-gray-900 dark:text-app-ink">
                  {formatCurrency(cashflowPrediction)}
                </span>{" "}this month{isEarlyEstimate ? " (early estimate)." : "."}</>
            ) : (
              "Add expenses to see your monthly spending forecast."
            )}
          </p>
        </div>

        {health > 0 && (
          <div className="flex-shrink-0 text-right">
            <button
              type="button"
              onClick={() => setShowScoreExplainer((v) => !v)}
              className="group flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted"
              aria-expanded={showScoreExplainer}
            >
              Health score
              <HelpCircle className="h-3.5 w-3.5 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-app-muted dark:group-hover:text-gray-300" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setShowScoreExplainer((v) => !v)}
              className="block w-full cursor-pointer text-right"
            >
              <p className={`mt-0.5 font-bold leading-none tabular-nums text-5xl ${healthColor(health)}`}>
                {Math.round(health)}
              </p>
              <p className={`mt-0.5 text-xs font-semibold ${healthColor(health)}`}>
                {healthLabel(health)}
              </p>
              <div className="ml-auto mt-2 h-1 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${healthBarColor(health)}`}
                  style={{ width: `${Math.min(100, health)}%` }}
                />
              </div>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showScoreExplainer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left dark:border-white/5 dark:bg-white/5">
              {breakdown ? (
                <>
                  <div className="space-y-2.5">
                    {[
                      { label: "Savings rate", score: breakdown.savings_rate },
                      { label: "Budget adherence", score: breakdown.budget_adherence },
                      { label: "Spending consistency", score: breakdown.spending_control },
                    ].map(({ label, score }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-300">{label}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{Math.round(score)}/100</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full ${factorBarColor(score)}`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {Array.isArray(reasons) && reasons.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-gray-200 pt-2 dark:border-white/10">
                      {reasons.map((r, i) => (
                        <li key={i} className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  {fallbackHealthText(health)}
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate("/analytics")}
                className="mt-2.5 text-xs font-medium text-app-accent hover:underline"
              >
                See full breakdown →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {totalIncome > 0 ? (
        <>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-app-accent/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-app-accent" />
              </div>
              <div>
                <p className="text-xs text-app-muted uppercase tracking-wide">Safe to spend today</p>
                <p className="text-2xl font-bold font-mono text-app-accent">₹{safeToSpendPerDay.toLocaleString('en-IN')}<span className="text-sm font-normal text-app-muted">/day</span></p>
              </div>
            </div>
            <button onClick={() => navigate('/calendar')} className="text-xs text-app-accent border border-app-accent/30 rounded-lg px-3 py-1.5 hover:bg-app-accent/10 transition-colors flex items-center gap-1">
              View cashflow <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-app-muted mt-1.5 ml-14">
            {(() => {
              const daysPhrase = `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left this month`;
              if (usingBudgetFallback) {
                return emiBurden > 0
                  ? `Based on your income (30% reserved for savings), ${formatCurrency(emiBurden)} EMIs, and ${daysPhrase}`
                  : `Based on your income (30% reserved for savings) and ${daysPhrase}`;
              }
              return emiBurden > 0
                ? `Based on your income, budgets, ${formatCurrency(emiBurden)} EMIs, and ${daysPhrase}`
                : `Based on your income, budgets, and ${daysPhrase}`;
            })()}
          </p>
          {usingBudgetFallback && (
            <button
              type="button"
              onClick={() => navigate('/budgets')}
              className="ml-14 mt-1 block text-xs text-app-accent hover:underline cursor-pointer"
            >
              Set budgets for a more accurate number →
            </button>
          )}
        </>
      ) : (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3 bg-app-accent/5 border border-app-accent/15 rounded-xl p-3">
            <Wallet className="w-5 h-5 text-app-accent flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-900 dark:text-white font-medium">Add your income to see daily safe-to-spend</p>
              <p className="text-xs text-app-muted">We'll calculate how much you can spend each day</p>
            </div>
            <button className="text-xs bg-app-accent text-white rounded-lg px-3 py-1.5 whitespace-nowrap">Add Income</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroBanner;
