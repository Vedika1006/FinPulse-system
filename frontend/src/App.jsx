import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Budgets from "./pages/Budgets";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
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
                <Route path="expenses"  element={<Expenses />}  />
                <Route path="budgets"   element={<Budgets />}   />
                <Route path="analytics" element={<Analytics />} />
                <Route path="settings"  element={<Settings />}  />
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