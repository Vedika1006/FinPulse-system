import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Moon, Settings, Sparkles, Sun, Menu } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";

const ROUTE_TITLES = [
  { match: /^\/$/, title: "Dashboard", subtitle: "Overview & signals" },
  { match: /^\/expenses\/?$/, title: "Expenses", subtitle: "Track every rupee" },
  { match: /^\/budgets\/?$/, title: "Budgets", subtitle: "Plans vs actuals" },
  { match: /^\/analytics\/?$/, title: "Analytics", subtitle: "Trends & health" },
  { match: /^\/settings\/?$/, title: "Settings", subtitle: "Profile & preferences" },
  { match: /^\/subscriptions\/?$/, title: "Subscriptions", subtitle: "Recurring payments & control" },
];

const Navbar = ({ toggleSidebar, alerts }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const meta = useMemo(() => {
    const found = ROUTE_TITLES.find((r) => r.match.test(location.pathname));
    return found ?? { title: "FinPulse", subtitle: "Command center" };
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-app-surface/70 dark:shadow-glow-sm sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 text-left">
          {toggleSidebar && (
            <button
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 md:hidden dark:text-app-muted dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white sm:text-xl">
                {meta.title}
              </h2>
              <span
                className="hidden shrink-0 rounded-full border border-gray-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:border-white/10 dark:bg-gradient-to-r dark:from-app-primary/40 dark:to-app-secondary/40 dark:text-app-subtle dark:shadow-inner sm:inline-flex sm:items-center sm:gap-1"
                title="AI-assisted insights"
              >
                <Sparkles className="h-3 w-3 text-blue-600 dark:text-app-highlight" aria-hidden />
                Pro
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-app-muted sm:text-sm">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Theme toggle — icon only */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-app-subtle dark:hover:border-app-accent/30 dark:hover:text-white"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Settings — icon only (preserved label for screen readers) */}
          <Link
            to="/settings"
            title="Settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-app-subtle dark:hover:border-app-accent/30 dark:hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </Link>

          {/* Notification bell */}
          <NotificationBell alerts={alerts} />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
