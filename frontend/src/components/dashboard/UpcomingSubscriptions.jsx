import { useState, useEffect } from "react";
import { Repeat } from "lucide-react";
import API from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../utils/currency";
import { getDueLabel } from "../../utils/dueDate";

const UpcomingSubscriptions = () => {
  const { currency } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/recurring/upcoming", { params: { days: 7 } })
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.05] dark:bg-app-card">
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
        <div className="mt-3 space-y-2">
          <div className="h-10 rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-10 rounded-xl bg-gray-100 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.05] dark:bg-app-card">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-app-ink">
        <Repeat className="h-4 w-4 text-blue-400" aria-hidden />
        Upcoming This Week
      </h3>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 border-l-4 border-l-blue-300 bg-white px-3 py-2 dark:border-white/[0.05] dark:border-l-blue-300 dark:bg-app-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {item.description}
              </p>
              <p className="text-xs text-gray-500 dark:text-app-muted">
                {getDueLabel(item.next_due_date)}
              </p>
            </div>
            <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(item.amount, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingSubscriptions;
