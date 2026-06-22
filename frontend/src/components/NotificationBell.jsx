import { useState, useRef, useEffect } from "react";
import { Bell, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationBell({ alerts = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("expense_ai_read_alerts")) || [];
    } catch {
      return [];
    }
  });

  const menuRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadAlerts = alerts.filter((a) => !readIds.includes(a.id));

  const markAsRead = (id) => {
    const updated = [...readIds, id];
    setReadIds(updated);
    localStorage.setItem("expense_ai_read_alerts", JSON.stringify(updated));
  };

  const markAllRead = () => {
    const updated = [...new Set([...readIds, ...alerts.map((a) => a.id)])];
    setReadIds(updated);
    localStorage.setItem("expense_ai_read_alerts", JSON.stringify(updated));
  };

  const handleAlertClick = (alert) => {
    markAsRead(alert.id);
    setIsOpen(false);
    if (alert.link) navigate(alert.link);
  };

  const getIcon = (severity) => {
    switch (severity) {
      case "danger":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:bg-app-surface dark:text-gray-300 dark:hover:bg-white/5"
      >
        <Bell className="h-5 w-5" />
        {unreadAlerts.length > 0 && (
          <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-app-surface"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-2xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-white/10 dark:bg-app-card dark:ring-white/10 sm:w-96 z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {unreadAlerts.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto py-2">
            {unreadAlerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-app-muted">
                No new notifications
              </div>
            ) : (
              unreadAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className="flex w-full items-start gap-4 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <div className="mt-0.5 shrink-0">{getIcon(alert.severity)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-200">{alert.message}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
