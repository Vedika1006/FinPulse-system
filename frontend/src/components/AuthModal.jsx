import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, X } from "lucide-react";
import { login, forgotPassword, resetPassword } from "../api/auth";
import API from "../api/axios";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-app-card/80 dark:text-white dark:placeholder:text-app-muted dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/15";

const normalizeMode = (m) => (m === "signup" ? "register" : m || "login");

export default function AuthModal({ isOpen, onClose, initialMode = "login" }) {
  const [mode,         setMode]         = useState(normalizeMode(initialMode));
  const [email,        setEmail]        = useState("");
  const [name,         setName]         = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token,        setToken]        = useState("");
  const [error,        setError]        = useState("");
  const [successMsg,   setSuccessMsg]   = useState("");
  const [loading,      setLoading]      = useState(false);

  // Reset form each time modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(normalizeMode(initialMode));
      setEmail("");
      setName("");
      setPassword("");
      setToken("");
      setError("");
      setSuccessMsg("");
      setShowPassword(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

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
        onClose();
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
        onClose();
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

  const isAuthMode = mode === "login" || mode === "register";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-label="Authentication"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-app-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Back link for non-auth modes */}
            {!isAuthMode && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mb-4 flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                ← Back to login
              </button>
            )}

            {/* Heading */}
            <h2 className="mb-0.5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {mode === "login"    && "Welcome back"}
              {mode === "register" && "Create your account"}
              {mode === "forgot"   && "Reset your password"}
              {mode === "reset"    && "Set new password"}
            </h2>
            <p className="mb-5 text-sm text-gray-500 dark:text-app-muted">
              {mode === "login"    && "Sign in to your FinPulse workspace"}
              {mode === "register" && "Start tracking your finances with AI"}
              {mode === "forgot"   && "Enter your email and we'll send a recovery token"}
              {mode === "reset"    && "Enter your recovery token and choose a new password"}
            </p>

            {/* Tab switcher */}
            {isAuthMode && (
              <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-card/60">
                {[
                  { key: "login",    label: "Log in"   },
                  { key: "register", label: "Register" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchMode(key)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                      mode === key
                        ? "bg-white text-cyan-600 shadow-sm dark:bg-app-surface dark:text-cyan-400"
                        : "text-gray-500 hover:text-gray-700 dark:text-app-muted dark:hover:text-app-subtle"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Form */}
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

              {/* Token — reset only, else email */}
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

              {/* Password */}
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
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Forgot link */}
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
                {loading           ? "Please wait…"
                : mode === "forgot"  ? "Send recovery token"
                : mode === "reset"   ? "Reset password"
                : mode === "register"? "Create account"
                :                     "Log in"}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-gray-400 dark:text-app-muted">
              <Lock className="h-3 w-3" aria-hidden />
              <span className="text-xs">256-bit encryption · your data stays private</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
