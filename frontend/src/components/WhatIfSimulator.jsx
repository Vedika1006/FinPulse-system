import React, { useState, useEffect } from 'react';

const WhatIfSimulator = ({ income = 0, expense = 0 }) => {
  const [expenseReduction, setExpenseReduction] = useState(0);
  const [incomeIncrease, setIncomeIncrease] = useState(0);

  const [newIncome, setNewIncome] = useState(income);
  const [newExpense, setNewExpense] = useState(expense);
  const [savings, setSavings] = useState(0);
  const [healthScore, setHealthScore] = useState(0);

  useEffect(() => {
    const calculatedIncome = income + incomeIncrease;
    const calculatedExpense = expense - expenseReduction;
    const calculatedSavings = calculatedIncome - calculatedExpense;

    setNewIncome(calculatedIncome);
    setNewExpense(calculatedExpense);
    setSavings(calculatedSavings);

    if (calculatedIncome > 0) {
      setHealthScore((calculatedSavings / calculatedIncome) * 100);
    } else {
      setHealthScore(0);
    }
  }, [income, expense, expenseReduction, incomeIncrease]);

  return (
    <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md mx-auto font-sans dark:bg-[#171A35] dark:border-white/10">
      <h3 className="text-xl font-bold text-gray-800 mb-6 dark:text-white">What-If Financial Simulator</h3>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-600 dark:text-[#9AA3B2]">Increase Income</label>
            <span className="text-sm font-bold text-green-600">+₹{incomeIncrease.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="0"
            max="20000"
            step="500"
            value={incomeIncrease}
            onChange={(e) => setIncomeIncrease(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500 dark:bg-gray-700"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-600 dark:text-[#9AA3B2]">Reduce Expenses</label>
            <span className="text-sm font-bold text-blue-600">-₹{expenseReduction.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="500"
            value={expenseReduction}
            onChange={(e) => setExpenseReduction(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 dark:bg-gray-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-[#1E2247] dark:border-white/10">
            <p className="text-xs font-medium text-gray-500 mb-1 dark:text-[#9AA3B2]">New Income</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">₹{newIncome.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-[#1E2247] dark:border-white/10">
            <p className="text-xs font-medium text-gray-500 mb-1 dark:text-[#9AA3B2]">New Expense</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">₹{newExpense.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between dark:bg-indigo-900/20 dark:border-indigo-500/20">
          <div>
            <p className="text-sm font-medium text-indigo-800 mb-1 dark:text-indigo-300">New Savings</p>
            <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100">₹{savings.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-indigo-600 mb-1 dark:text-indigo-400">Health Score</p>
            <p className="text-xl font-bold text-indigo-900 dark:text-indigo-100">{healthScore.toFixed(1)}%</p>
          </div>
        </div>

        <div className={`p-4 rounded-xl text-center text-sm font-bold transition-colors ${
          healthScore > 30 
            ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-500/30' 
            : 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-500/30'
        }`}>
          {healthScore > 30 ? "Great financial position" : "You need to improve savings"}
        </div>
      </div>
    </div>
  );
};

export default WhatIfSimulator;
