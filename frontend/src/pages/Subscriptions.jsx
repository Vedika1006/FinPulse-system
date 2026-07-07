import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Bell, Check, Pause, XCircle } from "lucide-react";
import API from "../api/axios";
import { getDueLabel, toLocalISODate } from "../utils/dueDate";

// ── Description display cleaning ────────────────────────────────────────────

const _PAYMENT_MODES = new Set([
  "neft", "rtgs", "imps", "upi", "mmt", "achd", "achc", "clg", "pos", "atm",
  "atw", "int", "trf", "bil", "ecs", "cr", "dr",
]);

function cleanDisplayName(desc) {
  if (!desc) return desc;
  let s = desc.trim();
  // 1. Strip leading payment-mode prefix (case-insensitive)
  s = s.replace(/^(NEFT|RTGS|IMPS|UPI|MMT|ACH\s*[DC]|CLG|POS|ATM\s*WDL?|ATW|INT|TRF|BIL|ECS)[/\s\-]+/i, "").trim();
  // 2. Split on BOTH slash and dash delimiters
  const parts = s.split(/[/\-]+/).map((p) => p.trim()).filter(Boolean);
  // 3. Filter noise tokens
  const cleaned = parts
    .filter((p) => {
      const pl = p.toLowerCase();
      if (/^[\d,.]+$/.test(p)) return false;           // pure number/amount
      if (/^\w+@\w+$/.test(p)) return false;            // UPI VPA handle
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p)) return false;  // IFSC code
      if (_PAYMENT_MODES.has(pl)) return false;          // standalone mode word
      if (pl === "com") return false;                    // payment-network suffix
      return true;
    })
    .map((p) => p.replace(/\b\d{6,}\b/g, "").trim())
    .filter(Boolean);
  let result = cleaned.join(" ").trim();
  // 4. Strip trailing " com" that survived inside a multi-word merchant name
  result = result.replace(/\s+com\s*$/i, "").trim();
  // 5. Collapse extra whitespace
  result = result.replace(/\s+/g, " ").trim();
  // 6. Title-case (handles both fully-uppercase raw bank strings and lowercase stored strings)
  if (result && (result === result.toUpperCase() || result === result.toLowerCase())) {
    result = result.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return result || desc.trim();
}

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
      name: cleanDisplayName(key),
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

// A detected pattern and a tracked (backend) item refer to the same
// subscription if the cleaned merchant name matches. Matching on name only
// (not amount) so a legitimate price change doesn't make an already-tracked
// subscription look untracked again.
function isSameSubscription(pattern, tracked) {
  return (pattern.name || "").trim().toLowerCase() === (tracked.description || "").trim().toLowerCase();
}

// Detection can estimate a nextDue that's already in the past (rounding
// drift in the average gap). Roll it forward to the next future occurrence
// so confirming a pattern doesn't immediately backfill a cycle that's
// already represented by the real expenses the detector found it from.
function rollToFutureDate(dueDate, frequency) {
  let d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d < today && guard < 240) {
    if (frequency === "weekly") {
      d = new Date(d.getTime() + 7 * 86_400_000);
    } else {
      d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    guard += 1;
  }
  return d;
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

  const [tracked, setTracked] = useState([]);
  const [trackedLoading, setTrackedLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyTrackedId, setBusyTrackedId] = useState(null);

  useEffect(() => {
    API.get("/expenses/")
      .then((res) => setExpenses(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refetchTracked = useCallback(() => {
    return API.get("/recurring")
      .then((res) => setTracked(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setTrackedLoading(false));
  }, []);

  useEffect(() => {
    refetchTracked();
  }, [refetchTracked]);

  const handleTrackPattern = useCallback(
    async (pattern) => {
      setConfirmingId(pattern.id);
      try {
        const dueDate = rollToFutureDate(pattern.nextDue, pattern.frequency);
        await API.post("/recurring", {
          description: pattern.name,
          amount: pattern.latestAmount,
          category: pattern.category,
          frequency: pattern.frequency,
          next_due_date: toLocalISODate(dueDate),
        });
        await refetchTracked();
      } catch {
        // Silently keep the "Track this" button available so the user can retry.
      } finally {
        setConfirmingId(null);
      }
    },
    [refetchTracked]
  );

  // Pause: is_paused=true, is_active stays true — the item stays in the
  // tracked list and can be resumed, but the recurring service skips it.
  const handlePauseToggle = useCallback(
    async (id, paused) => {
      setBusyTrackedId(id);
      try {
        await API.put(`/recurring/${id}`, { is_paused: paused });
        await refetchTracked();
      } catch {
        // no-op — item stays in the list so the user can retry
      } finally {
        setBusyTrackedId(null);
      }
    },
    [refetchTracked]
  );

  // Cancel: is_active=false (permanent) — the item disappears from the list.
  const handleCancelTracked = useCallback(
    async (id) => {
      setBusyTrackedId(id);
      try {
        await API.delete(`/recurring/${id}`);
        await refetchTracked();
      } catch {
        // no-op — item stays in the list so the user can retry
      } finally {
        setBusyTrackedId(null);
      }
    },
    [refetchTracked]
  );

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

  if (loading || trackedLoading) {
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

  // ── Main content ──────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Subscriptions & Recurring Payments
        </h2>
        <p className="text-sm text-app-muted mt-1">
          {recurring.length > 0 ? (
            <>
              ₹{monthlyTotal.toLocaleString("en-IN")}/month across {recurring.length} active payments
              {monthlyTotal > 0 && (
                <span> · That's ₹{(monthlyTotal * 12).toLocaleString("en-IN")} per year</span>
              )}
            </>
          ) : (
            "Track confirmed subscriptions and see automatically detected recurring charges below."
          )}
        </p>
      </div>

      {/* Tracked Subscriptions */}
      <motion.div className="mb-5" custom={0} initial="hidden" animate="visible" variants={fadeUp}>
        <p className="text-xs font-medium uppercase tracking-wider text-app-muted mb-2">
          Tracked Subscriptions
        </p>
        {tracked.length === 0 ? (
          <div className="rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-app-card p-3 text-sm text-gray-500 dark:text-app-muted">
            No tracked subscriptions yet — confirm a detected pattern below to start tracking.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tracked.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 border-l-4 rounded-xl p-3 ${
                  item.is_paused ? "border-l-amber-300 opacity-60" : "border-l-blue-300"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.description}
                    </p>
                    {item.is_paused && (
                      <span className="inline-flex flex-shrink-0 items-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-app-muted capitalize">
                    ₹{Number(item.amount).toLocaleString("en-IN")} · {item.frequency} · {item.category}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-app-muted">
                    Next due{" "}
                    {new Date(item.next_due_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.is_paused ? (
                    <button
                      type="button"
                      disabled={busyTrackedId === item.id}
                      onClick={() => handlePauseToggle(item.id, false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyTrackedId === item.id}
                      onClick={() => handlePauseToggle(item.id, true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-app-muted text-xs px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyTrackedId === item.id}
                    onClick={() => handleCancelTracked(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 text-red-400 text-xs px-2.5 py-1.5 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Detected patterns (client-side detection stays intact) */}
      {recurring.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <RefreshCw className="w-10 h-10 text-app-muted mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            No recurring payments detected yet
          </h3>
          <p className="text-sm text-app-muted max-w-sm">
            We'll spot subscriptions and repeated charges automatically once you
            have a couple months of expense history.
          </p>
        </div>
      ) : (
        <>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 p-3">
          <p className="text-xs text-gray-500 dark:text-app-muted uppercase tracking-wide mb-1">Monthly recurring</p>
          <p className="text-2xl font-bold font-mono text-app-accent">
            ₹{monthlyTotal.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 p-3">
          <p className="text-xs text-gray-500 dark:text-app-muted uppercase tracking-wide mb-1">Next due</p>
          {nextDueSub ? (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {nextDueSub.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-app-muted">
                ₹{nextDueSub.latestAmount.toLocaleString("en-IN")} · {getDueLabel(nextDueSub.nextDue)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-app-muted">—</p>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 p-3">
          <p className="text-xs text-gray-500 dark:text-app-muted uppercase tracking-wide mb-1">Price changes</p>
          {priceChangeCount > 0 ? (
            <p className="text-2xl font-bold font-mono text-amber-500">{priceChangeCount}</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-app-muted mt-1">No changes</p>
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
            {items.map((item) => {
              const alreadyTracked = tracked.some((t) => isSameSubscription(item, t));
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedSub(item)}
                  className="flex items-center justify-between gap-3 bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-xl p-3 cursor-pointer hover:border-app-accent/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-app-muted">
                      ₹{item.amount.toLocaleString("en-IN")}/month
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500 dark:text-app-muted">{getDueLabel(item.nextDue)}</span>
                    {alreadyTracked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        <Check className="w-3 h-3" /> Tracked
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={confirmingId === item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrackPattern(item);
                        }}
                        className="rounded-lg bg-app-accent text-white text-xs font-medium px-2.5 py-1.5 hover:bg-app-accent/90 transition-colors disabled:opacity-50"
                      >
                        {confirmingId === item.id ? "Tracking…" : "Track this"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
        </>
      )}

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
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-app-card border-l border-gray-200 dark:border-white/10 z-50 p-5 overflow-y-auto"
            >
              {/* Drawer header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                  {selectedSub.name}
                </h3>
                <button
                  onClick={closeDrawer}
                  className="text-gray-400 dark:text-app-muted hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
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
                <span className="text-sm text-gray-500 dark:text-app-muted">/month</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-app-muted mb-5">
                ₹{(selectedSub.amount * 12).toLocaleString("en-IN")}/year
              </p>

              {/* Details */}
              <div className="space-y-3 text-sm mb-6 border-t border-gray-100 dark:border-white/5 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-app-muted">Detected since</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {new Date(selectedSub.firstSeen).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-app-muted">Next renewal</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {getDueLabel(selectedSub.nextDue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-app-muted">Frequency</span>
                  <span className="text-gray-900 dark:text-white font-medium capitalize">
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
