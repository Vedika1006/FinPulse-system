import { useState, useEffect } from "react";
import {
  Eye, EyeOff, TrendingUp, ShieldCheck,
  MessageCircle, Sparkles, Lock,
} from "lucide-react";
import { login, forgotPassword, resetPassword } from "../api/auth";
import API from "../api/axios";

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "ML Anomaly Detection",
    desc: "Isolation Forest flags unusual spending before it becomes a problem.",
  },
  {
    Icon: TrendingUp,
    title: "Prophet Forecasting",
    desc: "30-day spending predictions with 80% confidence intervals.",
  },
  {
    Icon: MessageCircle,
    title: "AI Finance Assistant",
    desc: "Ask anything about your budgets, savings, and patterns.",
  },
];

const STATS = [
  { n: "₹50L+", l: "Tracked" },
  { n: "98%",   l: "Accuracy" },
  { n: "<3s",   l: "Insights" },
];

const Login = () => {
  useEffect(() => {
    if (localStorage.getItem("token") === "dummy") {
      localStorage.removeItem("token");
    }
  }, []);

  const [email,        setEmail]        = useState("");
  const [name,         setName]         = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token,        setToken]        = useState("");
  const [mode,         setMode]         = useState("login");
  const [error,        setError]        = useState("");
  const [successMsg,   setSuccessMsg]   = useState("");
  const [loading,      setLoading]      = useState(false);

  const switchMode = (next) => {
    setError("");
    setSuccessMsg("");
    setMode(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      if (mode === "register") {
        await API.post("/auth/register", { email, password, name });
        const data = await login(email, password);
        localStorage.setItem("token", data.access_token);
        window.location.href = "/";
      } else if (mode === "forgot") {
        const res = await forgotPassword(email);
        setSuccessMsg(res.message || "Reset token sent — check your email.");
        setMode("reset");
      } else if (mode === "reset") {
        const res = await resetPassword(token, password);
        setSuccessMsg(res.message || "Password updated. You can now log in.");
        setMode("login");
      } else {
        const data = await login(email, password);
        localStorage.setItem("token", data.access_token);
        window.location.href = "/";
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        "Something went wrong";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-app-card/80 dark:text-white dark:placeholder:text-app-muted dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/15";

  const isAuthMode = mode === "login" || mode === "register";

  return (
    <div className="flex min-h-screen">

      {/* ═══════════════════════════════════════════
          LEFT — branded panel (always dark)
      ═══════════════════════════════════════════ */}
      <div className="relative hidden overflow-hidden bg-[#06080F] px-10 py-10 lg:flex lg:w-[420px] lg:flex-col xl:w-[460px]">
        {/* Decorative rings */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-cyan-500/[0.07]" aria-hidden />
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-cyan-500/[0.05]" aria-hidden />
        <div className="pointer-events-none absolute -left-12 bottom-20 h-32 w-32 rounded-full bg-cyan-500/[0.03]" aria-hidden />

        {/* Logo */}
        <div className="mb-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-[11px] font-semibold tracking-tight text-[#06080F]">
            FP
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">FinPulse</span>
        </div>

        {/* AI badge */}
        <div className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-cyan-400">
          <Sparkles className="h-2.5 w-2.5" aria-hidden />
          AI-powered
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-[28px] font-semibold leading-[1.35] tracking-tight text-white">
          Your financial<br />intelligence layer
        </h1>
        <p className="mb-10 text-sm leading-relaxed text-gray-500">
          Real-time AI insights, anomaly detection, and spending forecasts — built for people who take money seriously.
        </p>

        {/* Features */}
        <div className="flex-1 space-y-5">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="mb-0.5 text-sm font-medium text-slate-200">{title}</p>
                <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-8 flex border-t border-white/[0.06] pt-6">
          {STATS.map(({ n, l }, i) => (
            <div
              key={l}
              className={`flex-1 text-center ${i > 0 ? "border-l border-white/[0.06]" : ""}`}
            >
              <p className="text-base font-semibold text-cyan-400">{n}</p>
              <p className="mt-0.5 text-[9.5px] uppercase tracking-wider text-gray-600">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          RIGHT — form panel (adapts to theme)
      ═══════════════════════════════════════════ */}
      <div className="flex flex-1 items-center justify-center bg-[#F5F7FB] px-6 py-10 dark:bg-app-bg">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo (hidden on desktop) */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-xs font-semibold text-[#06080F]">
              FP
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">FinPulse</span>
          </div>

          {/* Back link for forgot/reset modes */}
          {!isAuthMode && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="mb-5 flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              ← Back to login
            </button>
          )}

          {/* Heading */}
          <h2 className="mb-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {mode === "login"    && "Welcome back"}
            {mode === "register" && "Create your account"}
            {mode === "forgot"   && "Reset your password"}
            {mode === "reset"    && "Set new password"}
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-app-muted">
            {mode === "login"    && "Sign in to your FinPulse workspace"}
            {mode === "register" && "Start tracking your finances with AI"}
            {mode === "forgot"   && "Enter your email and we'll send a recovery token"}
            {mode === "reset"    && "Enter your recovery token and choose a new password"}
          </p>

          {/* Login / Register tab toggle */}
          {isAuthMode && (
            <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-card/60">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  mode === "login"
                    ? "bg-white text-cyan-600 shadow-sm dark:bg-app-surface dark:text-cyan-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-app-muted dark:hover:text-app-subtle"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  mode === "register"
                    ? "bg-white text-cyan-600 shadow-sm dark:bg-app-surface dark:text-cyan-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-app-muted dark:hover:text-app-subtle"
                }`}
              >
                Register
              </button>
            </div>
          )}

          {/* ── Form fields ── */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name — register only */}
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-app-subtle">
                  Full name
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Vedika Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            )}

            {/* Recovery token — reset only */}
            {mode === "reset" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-app-subtle">
                  Recovery token
                </label>
                <input
                  type="text"
                  placeholder="Paste your recovery token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-app-subtle">
                  Email address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="vedika@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            )}

            {/* Password — login, register, reset */}
            {(mode === "login" || mode === "register" || mode === "reset") && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-app-subtle">
                  {mode === "reset" ? "New password" : "Password"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Forgot password link */}
            {mode === "login" && (
              <div className="-mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Feedback */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (mode === "reset" && !token)}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading          ? "Please wait…"
              : mode === "forgot"  ? "Send recovery token"
              : mode === "reset"   ? "Reset password"
              : mode === "register"? "Create account"
              :                      "Log in"}
            </button>
          </form>

          {/* Security badge */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-gray-400 dark:text-app-muted">
            <Lock className="h-3 w-3" aria-hidden />
            <span className="text-xs">256-bit encryption · your data stays private</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
