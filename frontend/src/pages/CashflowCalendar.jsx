import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Info } from "lucide-react";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";
import API from "../api/axios";
import { getGoals } from "../api/goals";

// ── Recurring detection (mirrors Subscriptions.jsx, adds avgGap) ────────────

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
    if (minAmt === 0 || maxAmt / minAmt > 1.1) continue;

    const dates = sorted.map(getExpenseDate);
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / 86_400_000);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency = null;
    if (avgGap >= 5 && avgGap <= 9) frequency = "weekly";
    else if (avgGap >= 25 && avgGap <= 40) frequency = "monthly";
    else continue;

    const latestAmount = amounts[amounts.length - 1];
    const lastDate = dates[dates.length - 1];
    const nextDue = new Date(lastDate.getTime() + avgGap * 86_400_000);

    recurring.push({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      latestAmount,
      category: sorted[sorted.length - 1].category || "Other",
      frequency,
      avgGap,
      nextDue,
    });
  }

  return recurring;
}

// ── Project recurring items into a specific month ────────────────────────────

const BILL_RE = /rent|electric|util|water|gas|internet|broadband/i;

function projectEventsForMonth(recurring, year, month) {
  const events = [];
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  for (const sub of recurring) {
    const gap = sub.avgGap * 86_400_000;
    let anchor = new Date(sub.nextDue);

    // Arithmetic-shift anchor backward to at or before monthStart
    if (anchor > monthStart) {
      const steps = Math.ceil((anchor.getTime() - monthStart.getTime()) / gap);
      anchor = new Date(anchor.getTime() - steps * gap);
    }

    // Walk forward and emit every occurrence in [monthStart, monthEnd]
    let cur = new Date(anchor);
    while (cur <= monthEnd) {
      if (cur >= monthStart) {
        const isBill = BILL_RE.test(sub.category) || BILL_RE.test(sub.id);
        events.push({
          id: `${sub.id}-${cur.toISOString().slice(0, 10)}`,
          date: cur.toISOString().slice(0, 10),
          type: isBill ? "bill" : "subscription",
          label: sub.name,
          amount: sub.latestAmount,
        });
      }
      cur = new Date(cur.getTime() + gap);
    }
  }

  return events;
}

// ── Calendar helpers ─────────────────────────────────────────────────────────

function buildCalendarWeeks(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOT_COLOR = {
  income:       "bg-app-accent",
  goal:         "bg-violet-400",
  bill:         "bg-amber-400",
  subscription: "bg-blue-300",
  budget:       "bg-amber-300",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function CashflowCalendar() {
  const [today] = useState(() => new Date());

  const [currentMonth, setCurrentMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  // Default selected day = today
  const todayStr = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const [selectedDay, setSelectedDay] = useState(todayStr);

  const [expenses, setExpenses]         = useState([]);
  const [income, setIncome]             = useState(0);
  const [goals, setGoals]               = useState([]);
  const [totalBudget, setTotalBudget]   = useState(0);
  const [loading, setLoading]           = useState(true);

  // Fetch expenses, budgets, goals once
  useEffect(() => {
    Promise.all([
      API.get("/expenses/").catch(() => ({ data: [] })),
      API.get("/budgets/").catch(() => ({ data: [] })),
      getGoals().catch(() => []),
    ]).then(([expRes, budRes, goalsData]) => {
      setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
      const buds = Array.isArray(budRes.data) ? budRes.data : [];
      setTotalBudget(buds.reduce((s, b) => s + Number(b.amount || b.limit || 0), 0));
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setLoading(false);
    });
  }, []);

  // Re-fetch income whenever the displayed month changes
  useEffect(() => {
    const mStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}`;
    API.get(`/income/${mStr}/`)
      .then((res) => setIncome(Number(res.data?.amount || 0)))
      .catch(() => setIncome(0));
  }, [currentMonth]);

  const prevMonth = () =>
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  const nextMonth = () =>
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );

  const { year, month } = currentMonth;
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const daysRemaining = isCurrentMonth
    ? Math.max(daysInMonth - today.getDate() + 1, 1)
    : daysInMonth;

  const recurring = useMemo(() => detectRecurring(expenses), [expenses]);

  // All calendar events for the displayed month
  const calendarEvents = useMemo(() => {
    const events = [];

    // Income on the 1st — only if real income data exists for this month
    if (income > 0) {
      events.push({
        id: `income-${monthStr}`,
        date: `${monthStr}-01`,
        type: "income",
        label: "Income received",
        amount: income,
      });
    }

    // Budget reset — system event, always on the 1st
    events.push({
      id: `budget-${monthStr}`,
      date: `${monthStr}-01`,
      type: "budget",
      label: "Budget resets",
      amount: 0,
    });

    // Recurring subscriptions & bills
    events.push(...projectEventsForMonth(recurring, year, month));

    // Goals with a deadline this month
    for (const g of goals) {
      const deadline = g.deadline || g.target_date || g.due_date;
      if (deadline && String(deadline).startsWith(monthStr)) {
        const remaining =
          Number(g.target_amount || g.amount || 0) -
          Number(g.current_amount || g.saved_amount || 0);
        events.push({
          id: `goal-${g.id}`,
          date: String(deadline).slice(0, 10),
          type: "goal",
          label: `Goal: ${g.name || g.title || "Unnamed"}`,
          amount: Math.max(remaining, 0),
        });
      }
    }

    return events;
  }, [year, month, monthStr, income, recurring, goals]);

  // Index events by date string
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of calendarEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [calendarEvents]);

  // Expenses for the displayed month
  const monthExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        const d = new Date(e.date || e.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      }),
    [expenses, month, year]
  );

  const totalMonthExpenses = monthExpenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  // Summary stats
  const monthlyCommitted = useMemo(
    () =>
      calendarEvents
        .filter((e) => e.type === "bill" || e.type === "subscription")
        .reduce((s, e) => s + (e.amount || 0), 0),
    [calendarEvents]
  );

  const reserved = totalBudget > 0 ? totalBudget : income * 0.3;
  const availableToSpend = Math.max(income - reserved - totalMonthExpenses, 0);
  const safeToSpendPerDay =
    daysRemaining > 0 ? Math.round(availableToSpend / daysRemaining) : 0;

  // Projected balance — day-by-day running total
  const balanceData = useMemo(() => {
    // Pre-index actual expenses by normalized date string (slice to YYYY-MM-DD)
    const actualByDate = {};
    for (const e of monthExpenses) {
      const ds = (e.date || e.created_at || "").slice(0, 10);
      if (!actualByDate[ds]) actualByDate[ds] = 0;
      actualByDate[ds] += Number(e.amount || 0);
    }

    const data = [];
    let balance = income;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
      const dayDate = new Date(year, month, day);
      const isPastOrToday = dayDate <= today;

      if (isPastOrToday) {
        // Subtract actual recorded expenses for this day
        balance -= actualByDate[dateStr] || 0;
      } else {
        // Subtract projected bills and subscriptions
        const dayEv = (eventsByDate[dateStr] || []).filter(
          (e) => e.type !== "income" && e.type !== "budget" && e.type !== "goal"
        );
        balance -= dayEv.reduce((s, e) => s + (e.amount || 0), 0);
      }

      data.push({ day, balance: Math.round(Math.max(balance, 0)) });
    }
    return data;
  }, [daysInMonth, income, monthStr, year, month, monthExpenses, eventsByDate, today]);

  // Selected day detail
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];
  const selectedDayTotal = selectedDayEvents
    .filter((e) => e.type !== "income" && e.type !== "budget")
    .reduce((s, e) => s + (e.amount || 0), 0);

  const formattedSelectedDate = selectedDay
    ? new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long",
      })
    : "";

  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);

  const isSparseMonth = calendarEvents.length < 3;

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4 p-4">
        <div className="h-7 w-56 rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="h-4 w-72 rounded bg-gray-100 dark:bg-white/5" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-white/5" />
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (expenses.length === 0 && income === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="w-10 h-10 text-app-muted mb-3" />
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
          No cashflow data yet
        </h3>
        <p className="text-sm text-app-muted max-w-sm">
          Add your income and a few expenses to see your upcoming payments and
          safe-to-spend forecast.
        </p>
      </div>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Cashflow Calendar
        </h2>
        <p className="text-sm text-app-muted mt-1">
          See what's coming before it affects your balance
        </p>
      </div>

      {/* Summary strip — FIX 1: uniform neutral value style, ₹0 not "—" */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 p-3">
          <p className="text-xs text-gray-500 dark:text-app-muted uppercase tracking-wide mb-1">
            Expected income
          </p>
          <p className="text-xl font-mono font-semibold text-gray-900 dark:text-white">
            ₹{income.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 p-3">
          <p className="text-xs text-gray-500 dark:text-app-muted uppercase tracking-wide mb-1">
            Committed
          </p>
          <p className="text-xl font-mono font-semibold text-gray-900 dark:text-white">
            ₹{monthlyCommitted.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 p-3">
          <p className="text-xs text-gray-500 dark:text-app-muted uppercase tracking-wide mb-1">
            Safe to spend
          </p>
          <p className="text-xl font-mono font-semibold text-gray-900 dark:text-white">
            ₹{safeToSpendPerDay.toLocaleString("en-IN")}/day
          </p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-app-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {monthLabel}
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-app-muted transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* FIX 3 — Dot legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-app-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-app-accent" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Bills
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-300" /> Subscriptions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-400" /> Goals
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Risk
        </span>
      </div>

      {/* FIX 2 — Sparse data banner */}
      {isSparseMonth && (
        <div className="flex items-center gap-2 bg-app-accent/5 border border-app-accent/15 rounded-xl p-3 mb-4 text-sm text-app-muted">
          <Info className="w-4 h-4 text-app-accent flex-shrink-0" />
          Your calendar will fill in as you add income, bills, and recurring expenses. Right now we&apos;re showing what we know.
        </div>
      )}

      {/* Calendar grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={monthLabel}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-2xl p-3 mb-4"
        >
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="text-center text-xs text-gray-400 dark:text-app-muted py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks — FIX 2: h-12 cells instead of aspect-square, tighter gap */}
          <div className="flex flex-col gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="h-12" />;
                  }

                  const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isToday =
                    isCurrentMonth &&
                    today.getDate() === day &&
                    today.getMonth() === month &&
                    today.getFullYear() === year;
                  const isSelected = selectedDay === dateStr;

                  return (
                    <div
                      key={di}
                      onClick={() => setSelectedDay(dateStr)}
                      // FIX 4: today = teal day-number text; selected = bg tint; no conflicting ring
                      className={`h-12 rounded-lg p-1.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-app-accent/10"
                          : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <p
                        className={`text-xs leading-none ${
                          isToday
                            ? "text-app-accent font-semibold"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {day}
                      </p>
                      {/* Today marker dot — visible when today ≠ selected so they look distinct */}
                      {isToday && !isSelected && (
                        <span className="block w-1 h-1 rounded-full bg-app-accent mt-0.5" />
                      )}
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {dayEvents.slice(0, 3).map((ev, ei) => (
                          <span
                            key={ei}
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              DOT_COLOR[ev.type] || "bg-gray-300"
                            }`}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-gray-400 dark:text-app-muted leading-none mt-px">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Day detail panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDay || "none"}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-2xl p-4 mb-4"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            {formattedSelectedDate}
          </p>

          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-app-muted">
              No payments or income scheduled this day.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {selectedDayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          DOT_COLOR[ev.type] || "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {ev.label}
                      </span>
                    </div>
                    {ev.amount > 0 && (
                      <span className="text-sm font-mono text-gray-900 dark:text-white flex-shrink-0">
                        ₹{ev.amount.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {selectedDayTotal > 0 && (
                <div className="border-t border-gray-100 dark:border-white/5 mt-3 pt-3 flex justify-between text-sm">
                  <span className="text-app-muted">Total outgoing</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    ₹{selectedDayTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Projected balance chart — FIX 5: robust date comparison via actualByDate map */}
      <div className="bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-app-muted uppercase tracking-wide mb-3">
          Projected balance through {monthLabel}
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={balanceData} margin={{ top: 5, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#06B6D4"
              strokeWidth={2}
              fill="url(#balanceGradient)"
              dot={false}
              activeDot={{ r: 3, fill: "#06B6D4" }}
            />
            <Tooltip
              contentStyle={{
                background: "#112030",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#fff",
                padding: "6px 10px",
              }}
              itemStyle={{ color: "#06B6D4" }}
              formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Balance"]}
              labelFormatter={(day) => `Day ${day}`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
