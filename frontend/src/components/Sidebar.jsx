import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  BarChart3,
  Settings,
  Zap,
  Upload,
  CalendarDays,
  RefreshCcw,
  Inbox,
} from "lucide-react";

const NewBadge = () => (
  <span
    style={{
      fontSize: "9px",
      padding: "1px 6px",
      borderRadius: "999px",
      background: "rgba(6,182,212,0.15)",
      color: "#06B6D4",
      fontWeight: 600,
      lineHeight: "14px",
      flexShrink: 0,
    }}
  >
    New
  </span>
);

const GroupLabel = ({ children }) => (
  <p
    className="px-3 text-app-muted"
    style={{
      fontSize: "10px",
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginTop: "20px",
      marginBottom: "6px",
    }}
  >
    {children}
  </p>
);

const NavItem = ({ to, label, Icon, end = false, badge = false, setSidebarOpen }) => (
  <NavLink
    to={to}
    end={end}
    onClick={() => setSidebarOpen && setSidebarOpen(false)}
    className={({ isActive }) =>
      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        isActive
          ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-app-muted dark:hover:bg-white/5 dark:hover:text-white"
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          className={`h-[17px] w-[17px] flex-shrink-0 transition-colors ${
            isActive
              ? "text-cyan-600 dark:text-cyan-400"
              : "text-gray-400 group-hover:text-gray-600 dark:text-app-muted dark:group-hover:text-app-subtle"
          }`}
          strokeWidth={2}
          aria-hidden
        />
        <span className="flex-1">{label}</span>
        {badge && <NewBadge />}
        {isActive && (
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-500 dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(6,182,212,0.8)]"
            aria-hidden
          />
        )}
      </>
    )}
  </NavLink>
);

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 dark:border-white/[0.06] dark:bg-app-surface ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 border-b border-gray-200 px-5 py-5 dark:border-white/[0.06]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-[11px] font-semibold tracking-tight text-[#06080F]">
          FP
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
            FinPulse
          </h1>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
            Intelligence
          </p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-3 pt-4" aria-label="Main">

        {/* [unlabelled] */}
        <NavItem to="/"          label="Dashboard"      Icon={LayoutDashboard} end setSidebarOpen={setSidebarOpen} />

        {/* MONEY */}
        <GroupLabel>Money</GroupLabel>
        <NavItem to="/expenses"     label="Expenses"        Icon={Wallet}        setSidebarOpen={setSidebarOpen} />
        <NavItem to="/money/import" label="Income & Import" Icon={Upload}        badge setSidebarOpen={setSidebarOpen} />

        {/* PLAN */}
        <GroupLabel>Plan</GroupLabel>
        <NavItem to="/budgets"       label="Budgets & Goals"     Icon={PiggyBank}    setSidebarOpen={setSidebarOpen} />
        <NavItem to="/calendar"      label="Cashflow Calendar"   Icon={CalendarDays} badge setSidebarOpen={setSidebarOpen} />
        <NavItem to="/subscriptions" label="Subscriptions"       Icon={RefreshCcw}   badge setSidebarOpen={setSidebarOpen} />

        {/* INSIGHTS */}
        <GroupLabel>Insights</GroupLabel>
        <NavItem to="/analytics" label="Analytics"       Icon={BarChart3} setSidebarOpen={setSidebarOpen} />
        <NavItem to="/inbox"     label="Financial Inbox" Icon={Inbox}     badge setSidebarOpen={setSidebarOpen} />

        {/* Settings pinned before bottom ── pushed down via mt-auto */}
        <div className="mt-auto pt-4">
          <NavItem to="/settings" label="Settings" Icon={Settings} setSidebarOpen={setSidebarOpen} />
        </div>
      </nav>

      {/* ── AI badge ── */}
      <div className="border-t border-gray-200 p-4 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-cyan-500/15">
            <Zap className="h-3 w-3 text-cyan-500" aria-hidden />
          </div>
          <div>
            <p className="text-[11px] font-medium leading-none text-gray-700 dark:text-app-subtle">
              AI-powered insights
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400 dark:text-app-muted">
              Updates as you track
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
