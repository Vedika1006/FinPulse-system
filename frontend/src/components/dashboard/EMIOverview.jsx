import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark } from "lucide-react";
import API from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../utils/currency";

const EMIOverview = () => {
  const navigate = useNavigate();
  const { currency } = useTheme();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/emi/summary")
      .then((res) => setSummary(res.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.05] dark:bg-app-card">
        <div className="h-3 w-28 rounded bg-gray-200 dark:bg-white/10" />
        <div className="mt-3 h-8 w-32 rounded bg-gray-100 dark:bg-white/5" />
      </div>
    );
  }

  if (!summary || summary.active_loans === 0) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/emi")}
      className="w-full rounded-2xl border border-gray-100 border-l-4 border-l-red-400 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-white/[0.05] dark:border-l-red-400 dark:bg-app-card"
    >
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-app-ink">
        <Landmark className="h-4 w-4 text-red-500 dark:text-red-400" aria-hidden />
        EMI Overview
      </h3>
      <p className="font-mono text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
        {formatCurrency(summary.total_monthly_emi, currency)}
        <span className="ml-1 text-sm font-normal text-gray-500 dark:text-app-muted">/month</span>
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">
        {summary.active_loans} active loan{summary.active_loans === 1 ? "" : "s"}
      </p>
    </button>
  );
};

export default EMIOverview;
