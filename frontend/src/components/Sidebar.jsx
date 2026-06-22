import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wallet, PiggyBank, BarChart3, Settings } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/expenses", label: "Expenses", Icon: Wallet, end: false },
  { to: "/budgets", label: "Budgets", Icon: PiggyBank, end: false },
  { to: "/analytics", label: "Analytics", Icon: BarChart3, end: false },
  { to: "/settings", label: "Settings", Icon: Settings, end: false },
];

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white shadow-sm transition-transform duration-300 md:relative md:translate-x-0 dark:border-white/10 dark:bg-app-surface/95 dark:shadow-glow-sm dark:backdrop-blur-xl ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="border-b border-gray-200 px-5 py-6 text-left dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm dark:bg-gradient-to-br dark:from-app-secondary dark:to-app-accent dark:shadow-glow-sm dark:ring-white/20">
            <span className="text-lg" aria-hidden>
              {"\u25C8"}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">ExpenseAI</h1>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-app-muted">
              Intelligence
            </p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-transparent bg-blue-50 text-blue-600 dark:border-app-accent/40 dark:bg-gradient-to-r dark:from-app-primary/50 dark:via-app-secondary/35 dark:to-transparent dark:text-white dark:shadow-glow-active dark:shadow-indigo-500/20 dark:ring-white/10"
                  : "border-transparent bg-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-app-subtle dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white dark:hover:shadow-indigo-500/10",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    isActive
                      ? "border-blue-100 bg-white text-blue-600 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-app-highlight dark:shadow-inner"
                      : "border-gray-200 bg-gray-50 text-gray-500 group-hover:border-gray-300 group-hover:text-blue-600 dark:border-white/5 dark:bg-white/5 dark:text-app-muted dark:group-hover:border-white/15 dark:group-hover:text-app-highlight",
                  ].join(" ")}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="flex-1 text-left">{label}</span>
                {isActive ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-app-highlight dark:shadow-[0_0_12px_rgba(138,124,255,0.9)]"
                    aria-hidden
                  />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-gray-200 p-4 dark:border-white/10">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left shadow-sm dark:border-white/10 dark:bg-gradient-to-br dark:from-app-card/90 dark:to-app-primary/20 dark:shadow-inner dark:backdrop-blur-md">
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Premium workspace</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-app-muted">
            Insights refresh as you record activity.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
