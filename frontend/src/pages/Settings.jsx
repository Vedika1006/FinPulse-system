import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../components/ToastProvider";
import { clearAuthToken } from "../utils/auth";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import { Check, LogOut, ShieldAlert, Key } from "lucide-react";

const CardSection = ({ title, children }) => (
  <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171A35]">
    <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

const ToggleSwitch = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
      checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

export default function Settings() {
  const { theme, setTheme, currency, setCurrency } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "" });

  const [profile, setProfile] = useState({
    name: "",
    email: "",
  });

  const [prefs, setPrefs] = useState({
    emailAlerts: true,
    weeklyReport: true,
    budgetAlerts: false,
    currency: "INR",
    weekStart: "Monday",
    defaultCategory: "Food",
  });

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
    navigate("/login");
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      clearAuthToken();
      navigate("/login");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-black/20 dark:text-gray-100 disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-white/5";

  const getInitials = (name, email) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  if (loading) {
    return <div className="p-12 text-center text-sm font-medium text-gray-500">Loading settings...</div>;
  }

  return (
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
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
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
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-70 dark:shadow-glow-sm"
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
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-400 transform scale-[1.02] shadow-sm"
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
                  <option value="Food">Food & Dining</option>
                  <option value="Transport">Transportation</option>
                  <option value="Utilities">Utilities & Bills</option>
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
                className={`relative flex cursor-pointer items-center justify-between rounded-xl border p-4 transition duration-200 outline-none focus:ring-2 focus:ring-blue-600/30 ${
                  theme === "light"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/10"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${theme === 'light' ? 'border-blue-600' : 'border-gray-400'}`}>
                    {theme === 'light' && <div className="h-2 w-2 rounded-full bg-blue-600" />}
                  </div>
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-blue-900 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>Light Mode</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`relative flex cursor-pointer items-center justify-between rounded-xl border p-4 transition duration-200 outline-none focus:ring-2 focus:ring-blue-600/30 ${
                  theme === "dark"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/10"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${theme === 'dark' ? 'border-blue-600' : 'border-gray-400'}`}>
                    {theme === 'dark' && <div className="h-2 w-2 rounded-full bg-blue-600" />}
                  </div>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-900 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>Dark Mode</span>
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
          <CardSection title="Security & Access">
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
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-70"
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
  );
}
