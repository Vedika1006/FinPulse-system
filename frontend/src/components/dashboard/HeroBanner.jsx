import { Wallet, ArrowRight } from "lucide-react";
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

const HeroBanner = ({ displayName, health, cashflowPrediction, formatCurrency, income, totalExpenses, totalBudget }) => {
  const navigate = useNavigate();

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - today.getDate() + 1;

  const totalIncome = income || 0;
  const reserved = totalBudget > 0 ? totalBudget : totalIncome * 0.3;
  const availableToSpend = Math.max(totalIncome - reserved - (totalExpenses || 0), 0);
  const safeToSpendPerDay = daysRemaining > 0 ? Math.round(availableToSpend / daysRemaining) : 0;

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
            {cashflowPrediction > 0 ? (
              <>On track to spend{" "}
                <span className="font-semibold text-gray-900 dark:text-app-ink">
                  {formatCurrency(cashflowPrediction)}
                </span>{" "}this month.</>
            ) : (
              "Add expenses to see your monthly spending forecast."
            )}
          </p>
        </div>

        {health > 0 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
              Health score
            </p>
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
          </div>
        )}
      </div>

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
          <p className="text-xs text-app-muted mt-1.5 ml-14">Based on your income, budgets, and {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left this month</p>
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
