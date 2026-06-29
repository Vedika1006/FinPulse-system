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
      <div className="w-full animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.05] dark:bg-app-card">
        <div className="h-3 w-36 rounded bg-gray-200 dark:bg-white/10" />
        <div className="mt-3 space-y-2">
          <div className="h-14 rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-14 rounded-xl bg-gray-100 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (anomalies.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-app-ink">
        <Zap className="h-4 w-4 text-amber-500" aria-hidden />
        Unusual Spending Detected
      </h3>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-0.5">
        {anomalies.map((anomaly, idx) => {
          const key  = (anomaly.severity || "low").toLowerCase();
          const cfg  = SEVERITY_CONFIG[key] || SEVERITY_CONFIG.low;
          const Icon = cfg.Icon;

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${cfg.container}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${cfg.iconColor}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-sm font-semibold text-gray-900 dark:text-app-ink">
                    ₹{Number(anomaly.amount).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-app-muted">
                    on {anomaly.category}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className={`text-xs font-medium ${cfg.iconColor}`}>{anomaly.reason}</p>
                <p className="mt-0.5 text-[10px] text-gray-400 dark:text-app-muted">{anomaly.date}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnomalyAlerts;
