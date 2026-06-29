import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";

const KPICards = ({
  income,
  totalCredit,
  totalExpenses,
  savings,
  weekly,
  formatCurrency,
  btnPrimary,
  setIncomeModal,
}) => {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Income */}
      <div className="h-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card border-l-4 border-l-emerald-500">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
          <TrendingUp className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Income</p>
        {income?.amount ? (
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-gray-900 dark:text-app-ink">
            {formatCurrency(totalCredit)}
          </p>
        ) : (
          <button type="button" onClick={() => setIncomeModal(true)} className={`mt-2 ${btnPrimary} px-3 py-1.5 text-xs`}>
            Add income
          </button>
        )}
      </div>

      {/* Expenses */}
      <div className="h-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card border-l-4 border-l-orange-400">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10">
            <Wallet className="h-[18px] w-[18px] text-orange-600 dark:text-orange-400" aria-hidden />
          </div>
          {weekly.prevTotal > 0 && (
            <div className={`flex items-center gap-0.5 text-[10px] font-medium ${weekly.pct > 0 ? "text-red-500" : "text-emerald-500"}`}>
              {weekly.pct > 0
                ? <TrendingUp className="h-3 w-3" aria-hidden />
                : <TrendingDown className="h-3 w-3" aria-hidden />}
              {Math.abs(weekly.pct).toFixed(0)}% vs last week
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Expenses</p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-gray-900 dark:text-app-ink">
          {formatCurrency(totalExpenses)}
        </p>
        {weekly.topCategory && (
          <p className="mt-1 text-xs text-gray-400 dark:text-app-muted">
            Top: {weekly.topCategory}
          </p>
        )}
      </div>

      {/* Savings */}
      <div className="h-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card border-l-4 border-l-blue-500">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
          <PiggyBank className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" aria-hidden />
        </div>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">Savings</p>
        {income?.amount ? (
          <>
            <p className={`mt-1 font-mono text-3xl font-bold tabular-nums ${savings < 0 ? "text-red-500" : "text-emerald-500"}`}>
              {formatCurrency(savings)}
            </p>
            {totalCredit > 0 && (
              <p className="mt-1 text-xs text-gray-400 dark:text-app-muted">
                {((savings / totalCredit) * 100).toFixed(1)}% savings rate
              </p>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-sm text-gray-400 dark:text-app-muted">Add income to calculate</p>
        )}
      </div>
    </div>
  );
};

export default KPICards;
