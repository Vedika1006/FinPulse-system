import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Bell } from "lucide-react";
import API from "../api/axios";

// ── Recurring detection ─────────────────────────────────────────────────────

function getExpenseDate(exp) {
  return new Date(exp.date || exp.created_at);
}

function detectRecurring(expenses) {
  const groups = {};
  for (const exp of expenses) {
    const key = (exp.description || exp.category || "").toLowerCase().trim();
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(exp);
  }

  const recurring = [];

  for (const [key, items] of Object.entries(groups)) {
    if (items.length < 2) continue;

    const sorted = [...items].sort((a, b) => getExpenseDate(a) - getExpenseDate(b));
    const amounts = sorted.map((e) => Number(e.amount));
    const minAmt = Math.min(...amounts);
    const maxAmt = Math.max(...amounts);

    // Amounts must stay within 10% of each other across all occurrences
    if (minAmt === 0 || maxAmt / minAmt > 1.1) continue;

    const dates = sorted.map(getExpenseDate);
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / 86_400_000);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency = null;
    let monthlyAmount = 0;
    const avgAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length;

    if (avgGap >= 5 && avgGap <= 9) {
      frequency = "weekly";
      monthlyAmount = avgAmt * 4.33;
    } else if (avgGap >= 25 && avgGap <= 40) {
      frequency = "monthly";
      monthlyAmount = avgAmt;
    } else {
      continue;
    }

    const latestAmount = amounts[amounts.length - 1];
    const previousAmount = amounts.length >= 2 ? amounts[amounts.length - 2] : null;
    const priceChanged = previousAmount !== null && latestAmount > previousAmount;
    const lastDate = dates[dates.length - 1];
    const nextDue = new Date(lastDate.getTime() + avgGap * 86_400_000);

    recurring.push({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      amount: Math.round(monthlyAmount),
      latestAmount,
      previousAmount,
      category: sorted[sorted.length - 1].category || "Other",
      frequency,
      firstSeen: dates[0].toISOString().slice(0, 10),
      nextDue,
      priceChanged,
    });
  }

  return recurring;
}

function getDueLabel(nextDue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86_400_000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Animation variant ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.28 },
  }),
};

// ── Component ───────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState(null);

  useEffect(() => {
    API.get("/expenses/")
      .then((res) => setExpenses(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedSub(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const recurring = useMemo(() => detectRecurring(expenses), [expenses]);

  const monthlyTotal = recurring.reduce((s, r) => s + r.amount, 0);
  const priceChangeCount = recurring.filter((r) => r.priceChanged).length;

  const nextDueSub = useMemo(() => {
    if (recurring.length === 0) return null;
    const now = new Date();
    const upcoming = recurring.filter((r) => r.nextDue >= now);
    return upcoming.length > 0
      ? upcoming.sort((a, b) => a.nextDue - b.nextDue)[0]
      : recurring[0];
  }, [recurring]);

  const grouped = useMemo(() => {
    const map = {};
    for (const item of recurring) {
      const cat = item.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return Object.entries(map);
  }, [recurring]);

  const closeDrawer = useCallback(() => setSelectedSub(null), []);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4 p-4">
        <div className="h-7 w-64 rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="h-4 w-48 rounded bg-gray-100 dark:bg-white/5" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (recurring.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <RefreshCw className="w-10 h-10 text-app-muted mb-3" />
        <h3 className="text-base font-medium text-app-ink dark:text-white mb-1">
          No recurring payments detected yet
        </h3>
        <p className="text-sm text-app-muted max-w-sm">
          We'll spot subscriptions and repeated charges automatically once you
          have a couple months of expense history.
        </p>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-app-ink dark:text-white">
          Subscriptions & Recurring Payments
        </h2>
        <p className="text-sm text-app-muted mt-1">
          ₹{monthlyTotal.toLocaleString("en-IN")}/month across {recurring.length} active payments
          {monthlyTotal > 0 && (
            <span> · That's ₹{(monthlyTotal * 12).toLocaleString("en-IN")} per year</span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl bg-app-card border border-white/5 p-3">
          <p className="text-xs text-app-muted uppercase tracking-wide mb-1">Monthly recurring</p>
          <p className="text-2xl font-bold font-mono text-app-accent">
            ₹{monthlyTotal.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl bg-app-card border border-white/5 p-3">
          <p className="text-xs text-app-muted uppercase tracking-wide mb-1">Next due</p>
          {nextDueSub ? (
            <>
              <p className="text-sm font-semibold text-app-ink dark:text-white truncate">
                {nextDueSub.name}
              </p>
              <p className="text-xs text-app-muted">
                ₹{nextDueSub.latestAmount.toLocaleString("en-IN")} · {getDueLabel(nextDueSub.nextDue)}
              </p>
            </>
          ) : (
            <p className="text-sm text-app-muted">—</p>
          )}
        </div>

        <div className="rounded-xl bg-app-card border border-white/5 p-3">
          <p className="text-xs text-app-muted uppercase tracking-wide mb-1">Price changes</p>
          {priceChangeCount > 0 ? (
            <p className="text-2xl font-bold font-mono text-amber-500">{priceChangeCount}</p>
          ) : (
            <p className="text-sm text-app-muted mt-1">No changes</p>
          )}
        </div>
      </div>

      {/* Grouped subscription list */}
      {grouped.map(([category, items], groupIdx) => (
        <motion.div
          key={category}
          className="mb-4"
          custom={groupIdx}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-app-muted mb-2">
            {category}
          </p>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedSub(item)}
                className="flex items-center justify-between bg-app-card border border-white/5 rounded-xl p-3 cursor-pointer hover:border-app-accent/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-app-ink dark:text-white">{item.name}</p>
                  <p className="text-xs text-app-muted">
                    ₹{item.amount.toLocaleString("en-IN")}/month
                  </p>
                </div>
                <span className="text-xs text-app-muted">{getDueLabel(item.nextDue)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedSub && (
          <>
            <motion.div
              onClick={closeDrawer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-app-card border-l border-white/10 z-50 p-5 overflow-y-auto"
            >
              {/* Drawer header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-app-ink dark:text-white pr-4">
                  {selectedSub.name}
                </h3>
                <button
                  onClick={closeDrawer}
                  className="text-app-muted hover:text-app-ink transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Amount */}
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-3xl font-bold font-mono text-app-accent">
                  ₹{selectedSub.amount.toLocaleString("en-IN")}
                </span>
                <span className="text-sm text-app-muted">/month</span>
              </div>
              <p className="text-sm text-app-muted mb-5">
                ₹{(selectedSub.amount * 12).toLocaleString("en-IN")}/year
              </p>

              {/* Details */}
              <div className="space-y-3 text-sm mb-6 border-t border-white/5 pt-4">
                <div className="flex justify-between">
                  <span className="text-app-muted">Detected since</span>
                  <span className="text-app-ink dark:text-white font-medium">
                    {new Date(selectedSub.firstSeen).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-muted">Next renewal</span>
                  <span className="text-app-ink dark:text-white font-medium">
                    {getDueLabel(selectedSub.nextDue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-muted">Frequency</span>
                  <span className="text-app-ink dark:text-white font-medium capitalize">
                    {selectedSub.frequency}
                  </span>
                </div>
                {selectedSub.priceChanged && selectedSub.previousAmount !== null && (
                  <div className="flex justify-between">
                    <span className="text-amber-500">Price increased</span>
                    <span className="text-amber-500 font-medium">
                      ₹{selectedSub.previousAmount.toLocaleString("en-IN")} → ₹{selectedSub.latestAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button className="w-full rounded-xl border border-red-400/40 text-red-400 text-sm py-2.5 hover:bg-red-400/10 transition-colors">
                  Mark as cancelled
                </button>
                <button className="w-full rounded-xl bg-app-accent text-white text-sm py-2.5 hover:bg-app-accent/90 transition-colors flex items-center justify-center gap-2">
                  <Bell className="w-4 h-4" /> Set reminder
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
