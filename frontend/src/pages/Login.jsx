import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, forgotPassword, resetPassword } from "../api/auth";
import API from "../api/axios";

const Login = () => {
  useEffect(() => {
    if (localStorage.getItem("token") === "dummy") {
      localStorage.removeItem("token");
    }
  }, []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

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
        setSuccessMsg(res.message || "Reset link sent.");
        setMode("reset");
      } else if (mode === "reset") {
        const res = await resetPassword(token, password);
        setSuccessMsg(res.message || "Password updated.");
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
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F7FB] px-4 py-10 dark:bg-app-bg">
      <form
        onSubmit={handleSubmit}
        className="relative z-[1] w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-left shadow-sm dark:border-white/10 dark:bg-app-card/90"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm dark:ring-1 dark:ring-white/20">
            <span className="text-xl" aria-hidden>
              {"\u25C8"}
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">ExpenseAI</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-app-muted">
            Secure access
          </p>
        </div>

        {mode === "login" || mode === "register" ? (
          <div className="mb-6 flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm dark:border-white/10 dark:bg-app-surface/60">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 font-semibold transition ${
                mode === "login" ? "bg-white text-blue-700 shadow-sm dark:bg-white/10 dark:text-white" : "text-gray-600 dark:text-app-muted"
              }`}
              onClick={() => { setError(""); setSuccessMsg(""); setMode("login"); }}
            >
              Log in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 font-semibold transition ${
                mode === "register" ? "bg-white text-blue-700 shadow-sm dark:bg-white/10 dark:text-white" : "text-gray-600 dark:text-app-muted"
              }`}
              onClick={() => { setError(""); setSuccessMsg(""); setMode("register"); }}
            >
              Register
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => { setError(""); setSuccessMsg(""); setMode("login"); }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              &larr; Back to login
            </button>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {mode === "forgot" ? "Reset your password" : "Enter new password"}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-app-muted">
              {mode === "forgot"
                ? "Enter your email address and we'll send you a recovery token."
                : "Submit your recovery token and new password."}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {mode === "register" ? (
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          ) : null}

          {mode === "reset" ? (
            <input
              type="text"
              name="token"
              placeholder="Recovery Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={inputClass}
              required
            />
          ) : (
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          )}

          {mode === "reset" ? (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="new-password"
                autoComplete="new-password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          ) : mode === "register" ? (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="new-password"
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          ) : mode === "login" ? (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="current-password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          ) : null}
        </div>

        {mode === "login" ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => { setError(""); setSuccessMsg(""); setMode("forgot"); }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-app-highlight dark:hover:text-blue-400"
            >
              Forgot password?
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {successMsg ? <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{successMsg}</p> : null}

        <button
          type="submit"
          disabled={loading || (mode === "reset" && !token)}
          className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-glow-sm"
        >
          {loading 
            ? "Please wait…" 
            : mode === "forgot" 
              ? "Send recovery token" 
              : mode === "reset" 
                ? "Reset password" 
                : mode === "register" 
                  ? "Create account" 
                  : "Log in"
          }
        </button>
      </form>
    </div>
  );
};

export default Login;
