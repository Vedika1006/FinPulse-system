import { useState, useEffect } from "react";
import { AlertOctagon, AlertTriangle, Info, Zap } from "lucide-react";
import API from "../api/axios";

const SEVERITY_CONFIG = {
  high: {
    Icon:       AlertOctagon,
    container:  "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20",
    iconColor:  "text-red-600 dark:text-red-400",
    badge:      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    label:      "High",
  },
  medium: {
    Icon:       AlertTriangle,
    container:  "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20",
    iconColor:  "text-amber-600 dark:text-amber-400",
    badge:      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    label:      "Medium",
  },
  low: {
    Icon:       Info,
    container:  "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20",
    iconColor:  "text-blue-600 dark:text-blue-400",
    badge:      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    label:      "Low",
  },
};

const AnomalyAlerts = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    API.get("/analytics/anomalies")
      .then((res) => setAnomalies(res.data?.anomalies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-32 w-full animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-app-surface" />
    );
  }

  if (anomalies.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-surface">
      {/* Header — Zap icon replaces 🚨 emoji */}
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
        <Zap className="h-4 w-4 text-amber-500" aria-hidden />
        Unusual Spending Detected
      </h3>

      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {anomalies.map((anomaly, idx) => {
          const key  = (anomaly.severity || "low").toLowerCase();
          const cfg  = SEVERITY_CONFIG[key] || SEVERITY_CONFIG.low;
          const Icon = cfg.Icon;

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${cfg.container}`}
            >
              {/* Severity icon replaces emoji */}
              <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${cfg.iconColor}`} aria-hidden />

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    ₹{Number(anomaly.amount).toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-app-muted">
                    on {anomaly.category}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className={`text-sm font-medium ${cfg.iconColor}`}>{anomaly.reason}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-app-muted">
                  {anomaly.date}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnomalyAlerts;
