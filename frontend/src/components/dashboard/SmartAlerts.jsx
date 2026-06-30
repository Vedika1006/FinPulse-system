import { AlertTriangle } from "lucide-react";

const SmartAlerts = ({ alerts, btnSecondary, navigate }) => {
  if (!alerts?.length) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-app-ink">Smart Alerts</h3>
        <button type="button" onClick={() => navigate("/analytics")} className={btnSecondary}>
          View details
        </button>
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
            a.tone === "red"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300"
              : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300"
          }`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <span>{a.text}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-gray-100 dark:border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => navigate("/inbox")}
          className="text-xs font-medium text-app-accent hover:underline"
        >
          View all in Inbox →
        </button>
      </div>
    </div>
  );
};

export default SmartAlerts;
