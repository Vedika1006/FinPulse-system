import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AIChat from "./AIChat";
import { currentMonthParam, getHealthScore } from "../api/analytics";
import { getBudgetVsActual } from "../api/budgets";
import { buildAlerts } from "../utils/buildAlerts";

const Layout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchAlertData = async () => {
      try {
        const month = currentMonthParam();
        const healthRes = await getHealthScore(month);
        const [budgets, expenses] = await getBudgetVsActual(month);
        const expenseSum = expenses.reduce((acc, curr) => acc + curr.total, 0);
        // Approximation: income is found securely in healthRes if we trace it, or we rely on total budgets 
        // to approximate. Actually, let's just do health score right now since it's universally fast:
        const generated = buildAlerts(healthRes, expenseSum, healthRes?.metrics?.total_income || 0);
        setAlerts(generated);
      } catch (err) {
        // fail silently
      }
    };
    fetchAlertData();
  }, [location.pathname]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#F5F7FB] text-gray-900 dark:bg-app-bg dark:text-app-ink">
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(106,90,224,0.35),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(91,108,255,0.12),transparent_50%),radial-gradient(ellipse_60%_40%_at_0%_80%,rgba(138,124,255,0.1),transparent_45%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 hidden dark:block bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_35%)]" aria-hidden />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 transition-opacity md:hidden dark:bg-black/60"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} alerts={alerts} />

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <AIChat />
    </div>
  );
};

export default Layout;
