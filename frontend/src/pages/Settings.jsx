import { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../components/ToastProvider";
import { clearAuthToken } from "../utils/auth";
import API from "../api/axios";
import { Check, LogOut, ShieldAlert, Key, X, AlertTriangle } from "lucide-react";

/* ── Confirm Dialog ────────────────────────────────────────────────────── */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  requireText,
  inputValue,
  onInputChange,
  loading,
}) => {
  if (!open) return null;
  const confirmDisabled =
    loading || (requireText != null && inputValue.trim().toLowerCase() !== requireText.trim().toLowerCase());
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-app-surface">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
          <div>
            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">{message}</p>
          </div>
        </div>
        {requireText != null && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Type <span className="font-semibold text-gray-900 dark:text-white">{requireText}</span> to confirm
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={onInputChange}
              disabled={loading}
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-gray-100"
            />
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Skeleton Loader ───────────────────────────────────────────────────── */
const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-white/10 ${className}`} />
);

const SettingsSkeleton = () => (
  <div className="mx-auto max-w-4xl space-y-6 pb-12">
    <div className="mb-6 space-y-2">
      <SkeletonBlock className="h-7 w-32" />
      <SkeletonBlock className="h-4 w-64" />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left column skeleton */}
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-surface">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
            <SkeletonBlock className="h-5 w-20" />
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-4">
              <SkeletonBlock className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-36" />
              </div>
            </div>
            <SkeletonBlock className="h-9 w-full" />
            <SkeletonBlock className="h-9 w-full" />
            <SkeletonBlock className="h-9 w-28" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-surface">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
            <SkeletonBlock className="h-5 w-24" />
          </div>
          <div className="space-y-3 p-6">
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-9" />)}
            </div>
            <SkeletonBlock className="h-9 w-full" />
            <SkeletonBlock className="h-9 w-full" />
          </div>
        </div>
      </div>
      {/* Right column skeleton */}
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-surface">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
            <SkeletonBlock className="h-5 w-28" />
          </div>
          <div className="space-y-3 p-6">
            <SkeletonBlock className="h-14 w-full" />
            <SkeletonBlock className="h-14 w-full" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-surface">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
            <SkeletonBlock className="h-5 w-28" />
          </div>
          <div className="space-y-6 p-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-3 w-44" />
                </div>
                <SkeletonBlock className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-surface">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
            <SkeletonBlock className="h-5 w-32" />
          </div>
          <div className="space-y-3 p-6">
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ── Card Section ──────────────────────────────────────────────────────── */
const CardSection = ({ title, children }) => (
  <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-surface">
    <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

/* ── Toggle Switch ─────────────────────────────────────────────────────── */
const ToggleSwitch = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
      checked ? "bg-teal-500" : "bg-gray-200 dark:bg-gray-700"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

/* ── Preferences persistence (localStorage — no backend table for this) ── */
const PREFS_KEY = "finpulse_user_preferences";
const DEFAULT_PREFS = {
  emailAlerts: true,
  weeklyReport: true,
  budgetAlerts: false,
  weekStart: "Monday",
  defaultCategory: "Food",
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/* ── Main Component ────────────────────────────────────────────────────── */
export default function Settings() {
  const { theme, setTheme, currency, setCurrency } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
  });

  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...(loadPrefs() || {}) }));
  const isFirstPrefsRender = useRef(true);

  // Persist on every change (skip the initial mount — that's a load, not a save).
  useEffect(() => {
    if (isFirstPrefsRender.current) {
      isFirstPrefsRender.current = false;
      return;
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    showToast("Preferences saved", "success");
  }, [prefs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get("/auth/me");
        setProfile({
          name: res.data.name || "",
          email: res.data.email || "",
        });
      } catch (err) {
        console.error("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await API.put("/auth/me", { name: profile.name });
      showToast("Profile updated successfully", "success");
    } catch {
      showToast("Could not update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await API.put("/auth/password", { current_password: passwordForm.current, new_password: passwordForm.new });
      showToast("Password updated successfully", "success");
      setShowPasswordForm(false);
      setPasswordForm({ current: "", new: "" });
    } catch (err) {
      showToast(err.response?.data?.detail || err.response?.data?.error || "Could not update password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    // Hard navigation (not react-router's navigate) so App.jsx's
    // isAuthenticated check — computed once per mount, not reactive state —
    // is freshly re-evaluated against the now-cleared token.
    window.location.replace("/?auth=login");
  };

  const handleDeleteAccount = () => {
    setDeleteConfirmText("");
    setShowDeleteConfirm(true);
  };

  const cancelDeleteAccount = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== profile.email.trim().toLowerCase()) return;
    setDeletingAccount(true);
    try {
      await API.delete("/auth/account");
      setShowDeleteConfirm(false);
      clearAuthToken();
      // Hard navigation — see handleLogout for why.
      window.location.replace("/?auth=login");
    } catch (err) {
      showToast(
        err.response?.data?.detail || err.response?.data?.error || "Could not delete account. Please try again.",
        "error"
      );
      // Do NOT log the user out or clear the dialog — the account still
      // exists, so they still need access to it.
    } finally {
      setDeletingAccount(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-black/20 dark:text-gray-100 disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-white/5";

  const getInitials = (name, email) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Account"
        message="This permanently deletes your account and every piece of data in it — expenses, income, budgets, goals, subscriptions, loans, tax records, everything. This cannot be undone."
        confirmLabel="Delete my account"
        requireText={profile.email}
        inputValue={deleteConfirmText}
        onInputChange={(e) => setDeleteConfirmText(e.target.value)}
        loading={deletingAccount}
        onConfirm={confirmDeleteAccount}
        onCancel={cancelDeleteAccount}
      />

      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <div className="mb-6 text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-app-muted">
            Manage your account, preferences, and security
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {/* Profile Section */}
            <CardSection title="Profile">
              <form onSubmit={handleProfileSave} className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                    {getInitials(profile.name, profile.email)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Your Avatar</p>
                    <p className="text-xs text-gray-500 dark:text-app-muted">Generated from your name</p>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Enter your name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Email cannot be changed.</p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-70 dark:shadow-glow-sm"
                  >
                    {savingProfile ? "Saving..." : "Edit Profile"}
                  </button>
                </div>
              </form>
            </CardSection>

            {/* Preferences Section */}
            <CardSection title="Preferences">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {["INR", "USD", "EUR", "GBP"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setCurrency(code)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          currency === code
                            ? "border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-400 shadow-sm"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5"
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Week Starts On</label>
                  <select
                    value={prefs.weekStart}
                    onChange={(e) => setPrefs({ ...prefs, weekStart: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Monday">Monday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Default Category</label>
                  <select
                    value={prefs.defaultCategory}
                    onChange={(e) => setPrefs({ ...prefs, defaultCategory: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Food">Food &amp; Dining</option>
                    <option value="Transport">Transportation</option>
                    <option value="Utilities">Utilities &amp; Bills</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </CardSection>
          </div>

          <div className="space-y-6">
            {/* Appearance Section */}
            <CardSection title="Appearance">
              <div className="flex flex-col space-y-3">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`relative flex cursor-pointer items-center justify-between rounded-xl border p-4 transition duration-200 outline-none focus:ring-2 focus:ring-teal-500/30 ${
                    theme === "light"
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/10"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${theme === 'light' ? 'border-teal-500' : 'border-gray-400'}`}>
                      {theme === 'light' && <div className="h-2 w-2 rounded-full bg-teal-500" />}
                    </div>
                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-teal-900 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'}`}>Light Mode</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`relative flex cursor-pointer items-center justify-between rounded-xl border p-4 transition duration-200 outline-none focus:ring-2 focus:ring-teal-500/30 ${
                    theme === "dark"
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/10"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${theme === 'dark' ? 'border-teal-500' : 'border-gray-400'}`}>
                      {theme === 'dark' && <div className="h-2 w-2 rounded-full bg-teal-500" />}
                    </div>
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-teal-900 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'}`}>Dark Mode</span>
                  </div>
                </button>
              </div>
            </CardSection>

            {/* Notifications Section */}
            <CardSection title="Notifications">
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Email Alerts</p>
                    <p className="text-xs text-gray-500 dark:text-app-muted">Receive important updates via email</p>
                  </div>
                  <ToggleSwitch
                    checked={prefs.emailAlerts}
                    onChange={() => setPrefs({ ...prefs, emailAlerts: !prefs.emailAlerts })}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Weekly Summary</p>
                    <p className="text-xs text-gray-500 dark:text-app-muted">Get weekly spending insights</p>
                  </div>
                  <ToggleSwitch
                    checked={prefs.weeklyReport}
                    onChange={() => setPrefs({ ...prefs, weeklyReport: !prefs.weeklyReport })}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Budget Alerts</p>
                    <p className="text-xs text-gray-500 dark:text-app-muted">Get notified when nearing budget limit</p>
                  </div>
                  <ToggleSwitch
                    checked={prefs.budgetAlerts}
                    onChange={() => setPrefs({ ...prefs, budgetAlerts: !prefs.budgetAlerts })}
                  />
                </div>
              </div>
            </CardSection>

            {/* Security Section */}
            <CardSection title="Security &amp; Access">
              <div className="flex flex-col gap-3">
                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-500" />
                      Change Password
                    </div>
                  </button>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-white/10 dark:bg-white/5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</h3>
                    <input
                      type="password"
                      placeholder="Current Password"
                      required
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      required
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                      className={inputClass}
                    />
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="flex-1 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-70"
                      >
                        {changingPassword ? "Saving..." : "Save Password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-black/20 dark:text-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-gray-500" />
                    Sign Out
                  </div>
                </button>

                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </CardSection>
          </div>
        </div>
      </div>
    </>
  );
}
