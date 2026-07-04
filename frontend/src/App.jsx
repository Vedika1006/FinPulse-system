import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Budgets from "./pages/Budgets";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
import MoneyImport from "./pages/MoneyImport";
import CashflowCalendar from "./pages/CashflowCalendar";
import Subscriptions from "./pages/Subscriptions";
import EMI from "./pages/EMI";
import FinancialInbox from "./pages/FinancialInbox";
import Layout from "./components/Layout";
import { ToastProvider } from "./components/ToastProvider";
import { hasValidAuthSession } from "./utils/auth";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const isAuthenticated = hasValidAuthSession();

  return (
    <Router>
      <ToastProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />

            {isAuthenticated ? (
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="expenses"     element={<Expenses />}        />
                <Route path="budgets"      element={<Budgets />}         />
                <Route path="analytics"    element={<Analytics />}       />
                <Route path="settings"     element={<Settings />}        />
                <Route path="money/import" element={<MoneyImport />}     />
                <Route path="calendar"     element={<CashflowCalendar />}/>
                <Route path="subscriptions" element={<Subscriptions />}  />
                <Route path="emi"          element={<EMI />}            />
                <Route path="inbox"        element={<FinancialInbox />}  />
              </Route>
            ) : (
              <Route path="/" element={<LandingPage />} />
            )}

            {!isAuthenticated && (
              <Route path="*" element={<Navigate to="/" replace />} />
            )}
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </Router>
  );
}

export default App;