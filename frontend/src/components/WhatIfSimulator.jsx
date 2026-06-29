import { useState, useEffect } from "react";

const WhatIfSimulator = ({ income = 0, expense = 0 }) => {
  const [expenseReduction, setExpenseReduction] = useState(0);
  const [incomeIncrease,   setIncomeIncrease]   = useState(0);
  const [newIncome,        setNewIncome]         = useState(income);
  const [newExpense,       setNewExpense]        = useState(expense);
  const [savings,          setSavings]           = useState(0);
  const [healthScore,      setHealthScore]       = useState(0);

  useEffect(() => {
    const calcIncome  = income + incomeIncrease;
    const calcExpense = expense - expenseReduction;
    const calcSavings = calcIncome - calcExpense;
    setNewIncome(calcIncome);
    setNewExpense(calcExpense);
    setSavings(calcSavings);
    setHealthScore(calcIncome > 0 ? (calcSavings / calcIncome) * 100 : 0);
  }, [income, expense, expenseReduction, incomeIncrease]);

  const sliderClass =
    "w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-app-surface";

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-app-ink">
        What-If Simulator
      </h3>

      <div className="space-y-4">
        {/* Income slider */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600 dark:text-app-muted">
              Increase income
            </label>
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              +₹{incomeIncrease.toLocaleString("en-IN")}
            </span>
          </div>
          <input type="range" min="0" max="20000" step="500"
            value={incomeIncrease}
            onChange={(e) => setIncomeIncrease(Number(e.target.value))}
            className={sliderClass}
            style={{ accentColor: "#10b981" }}
          />
        </div>

        {/* Expense slider */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600 dark:text-app-muted">
              Reduce expenses
            </label>
            <span className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400">
              -₹{expenseReduction.toLocaleString("en-IN")}
            </span>
          </div>
          <input type="range" min="0" max="10000" step="500"
            value={expenseReduction}
            onChange={(e) => setExpenseReduction(Number(e.target.value))}
            className={sliderClass}
            style={{ accentColor: "#06B6D4" }}
          />
        </div>

        {/* Result grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "New Income",  value: `₹${newIncome.toLocaleString("en-IN")}` },
            { label: "New Expense", value: `₹${newExpense.toLocaleString("en-IN")}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.04] dark:bg-app-surface">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">{label}</p>
              <p className="font-mono text-base font-bold text-gray-900 dark:text-app-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Savings highlight — using app-secondary (violet) accent */}
        <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-app-secondary/20 dark:bg-violet-900/20">
          <div>
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400">New Savings</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-violet-900 dark:text-violet-100">
              ₹{savings.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Health Score</p>
            <p className="font-mono text-xl font-bold tabular-nums text-violet-900 dark:text-violet-100">
              {healthScore.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Verdict */}
        <div className={`rounded-xl border p-3 text-center text-sm font-semibold transition-colors ${
          healthScore > 30
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-900/20 dark:text-emerald-300"
            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-300"
        }`}>
          {healthScore > 30 ? "Great financial position" : "Improve savings to strengthen score"}
        </div>
      </div>
    </div>
  );
};

export default WhatIfSimulator;
