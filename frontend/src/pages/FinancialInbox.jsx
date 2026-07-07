import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, PiggyBank, Sparkles, Inbox } from "lucide-react";
import API from "../api/axios";
import { getHealthScore, getInsight } from "../api/analytics";
import { currentMonthParam } from "../utils/month";
import { buildAlerts } from "../utils/buildAlerts";

// ── Animation helper — same pattern as Analytics.jsx ───────────────────────
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

// ── Constants ───────────────────────────────────────────────────────────────
const TABS = ["All", "Needs Action", "Budget Alerts", "Savings", "Risk", "AI Advice"];
const DISMISSED_KEY = "finpulse_dismissed_inbox";

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage unavailable/full — dismiss state just won't persist this session
  }
}

const TYPE_CFG = {
  budget:  { borderCls: "border-l-amber-500",  iconBg: "bg-amber-50 dark:bg-amber-500/10",   Icon: AlertTriangle, iconCls: "text-amber-600 dark:text-amber-400"   },
  risk:    { borderCls: "border-l-red-500",     iconBg: "bg-red-50 dark:bg-red-900/30",        Icon: AlertCircle,   iconCls: "text-red-600 dark:text-red-400"       },
  anomaly: { borderCls: "border-l-red-500",     iconBg: "bg-red-50 dark:bg-red-900/30",        Icon: AlertCircle,   iconCls: "text-red-600 dark:text-red-400"       },
  savings: { borderCls: "border-l-app-accent",  iconBg: "bg-cyan-50 dark:bg-app-accent/10",   Icon: PiggyBank,     iconCls: "text-cyan-600 dark:text-app-accent"   },
  ai:      { borderCls: "border-l-violet-500",  iconBg: "bg-violet-50 dark:bg-violet-500/10", Icon: Sparkles,      iconCls: "text-violet-600 dark:text-violet-400" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDateLabel(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function matchesTab(type, tab) {
  if (tab === "All")          return true;
  if (tab === "Needs Action") return type === "budget" || type === "anomaly" || type === "risk";
  if (tab === "Budget Alerts") return type === "budget";
  if (tab === "Savings")      return type === "savings";
  if (tab === "Risk")         return type === "anomaly" || type === "risk";
  if (tab === "AI Advice")    return type === "ai";
  return false;
}

function parseInsightToItems(insightPayload, today, navigate) {
  if (!insightPayload) return [];
  const raw = insightPayload.insights;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const data = { insight: "", risk: "", reason: "", action: "" };
  raw.forEach((line) => {
    if (!line) return;
    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) return;
    const value = rest.join(":").trim();
    const n = key.trim().toLowerCase();
    if (n.includes("insight"))                                                             data.insight = value;
    else if (n.includes("risk"))                                                           data.risk    = value;
    else if (n.includes("reason"))                                                         data.reason  = value;
    else if (n === "action" || n.includes("suggested action") || n.includes("suggestion")) data.action  = value;
  });

  const items = [];

  if (data.insight || data.reason) {
    items.push({
      id: "ai-insight",
      type: "ai",
      title: "AI Financial Insight",
      description: [data.insight, data.reason].filter(Boolean).join(" "),
      date: today,
      primaryAction: { label: "View Analytics", onClick: () => navigate("/analytics") },
    });
  }
  if (data.action) {
    items.push({
      id: "ai-action",
      type: "savings",
      title: "Suggested Action",
      description: data.action,
      date: today,
      primaryAction: { label: "Adjust Budget", onClick: () => navigate("/budgets") },
    });
  }
  if (data.risk) {
    items.push({
      id: "ai-risk",
      type: "risk",
      title: "Financial Risk Detected",
      description: data.risk,
      date: today,
      primaryAction: { label: "Review Expenses", onClick: () => navigate("/expenses") },
    });
  }

  return items;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FinancialInbox() {
  const navigate = useNavigate();
  const month    = currentMonthParam();

  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [dismissed, setDismissed] = useState(() => loadDismissed());
  const [activeTab, setActiveTab] = useState("All");

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    (async () => {
      try {
        const [health, incomeRes, anomalyRes, insightRes, expensesRes] = await Promise.all([
          getHealthScore(month).catch(() => null),
          API.get(`/income/${month}/`).catch(() => null),
          API.get("/analytics/anomalies").catch(() => ({ data: { anomalies: [] } })),
          getInsight(month).catch(() => null),
          API.get("/expenses/").catch(() => ({ data: [] })),
        ]);

        const allItems = [];

        // ── Budget / health alerts ─────────────────────────────────────────
        const incomeAmount = Number(incomeRes?.data?.amount || 0);
        const now = new Date();
        const expenses = Array.isArray(expensesRes?.data) ? expensesRes.data : [];
        const monthExpenses = expenses.filter((e) => {
          const d = new Date(e.date || e.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const totalMonthExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        const budgetAlerts = buildAlerts(health, incomeAmount, totalMonthExpenses);
        for (const a of budgetAlerts) {
          allItems.push({
            id: a.id,
            type: a.severity === "danger" ? "risk" : "budget",
            title: a.severity === "danger" ? "Budget Alert" : "Spending Notice",
            description: a.message,
            date: today,
            primaryAction: {
              label: "View Details",
              onClick: () => navigate(a.link || "/analytics"),
            },
          });
        }

        // ── Anomalies ──────────────────────────────────────────────────────
        const anomalies = anomalyRes?.data?.anomalies || [];
        for (const a of anomalies) {
          allItems.push({
            id: `anomaly-${a.expense_id}`,
            type: "anomaly",
            title: `Unusual ${a.category} expense`,
            description: a.reason,
            date: a.date || today,
            primaryAction: {
              label: "Review Expense",
              onClick: () => navigate("/expenses"),
            },
          });
        }

        // ── AI insight items ───────────────────────────────────────────────
        const aiItems = parseInsightToItems(insightRes, today, navigate);
        allItems.push(...aiItems);

        // Sort newest first
        allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        setItems(allItems);
      } catch (err) {
        console.error("[FinancialInbox]", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [month, navigate]);

  const visibleItems = useMemo(
    () => items.filter((item) => !dismissed.has(item.id) && matchesTab(item.type, activeTab)),
    [items, dismissed, activeTab]
  );

  // Group by date label, keeping Today → Yesterday → older order
  const grouped = useMemo(() => {
    const map = {};
    for (const item of visibleItems) {
      const label = toDateLabel(item.date);
      if (!map[label]) map[label] = [];
      map[label].push(item);
    }
    const PRIORITY = ["Today", "Yesterday"];
    const keys = Object.keys(map);
    const ordered = [
      ...PRIORITY.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !PRIORITY.includes(k)),
    ];
    return ordered.map((label) => [label, map[label]]);
  }, [visibleItems]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 animate-pulse">
        <div className="h-7 w-48 rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="h-4 w-72 rounded bg-gray-100 dark:bg-white/5" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Inbox</h2>
          <p className="text-sm text-app-muted mt-1">
            Your money updates, decisions and reminders in one place
          </p>
        </div>
        {dismissed.size > 0 && (
          <button
            type="button"
            onClick={clearDismissed}
            className="flex-shrink-0 text-xs font-medium text-app-muted hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Clear dismissed ({dismissed.size})
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-app-accent text-white"
                : "bg-white dark:bg-app-card border border-gray-100 dark:border-white/5 text-gray-600 dark:text-app-muted hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-10 h-10 text-app-muted mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            {activeTab === "All"
              ? "You're all caught up"
              : `No ${activeTab.toLowerCase()} items right now`}
          </h3>
          <p className="text-sm text-app-muted max-w-sm">
            New updates will appear here as FinPulse spots things that need your attention.
          </p>
        </div>
      ) : (
        <div>
          {grouped.map(([dateLabel, dateItems]) => (
            <div key={dateLabel} className="mb-5">
              <p className="text-xs font-medium uppercase tracking-wider text-app-muted mb-2">
                {dateLabel}
              </p>
              <div className="flex flex-col gap-2">
                {dateItems.map((item, idx) => {
                  const cfg  = TYPE_CFG[item.type] || TYPE_CFG.ai;
                  const Icon = cfg.Icon;
                  return (
                    <motion.div
                      key={item.id}
                      {...fadeUp(idx * 0.05)}
                      className={`bg-white dark:bg-app-card border-l-4 ${cfg.borderCls} border-y border-r border-gray-100 dark:border-white/5 rounded-xl p-4`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}
                        >
                          <Icon className={`w-4 h-4 ${cfg.iconCls}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-app-muted mt-0.5">{item.description}</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={item.primaryAction.onClick}
                              className="text-xs bg-app-accent text-white rounded-lg px-3 py-1.5"
                            >
                              {item.primaryAction.label}
                            </button>
                            <button
                              onClick={() => dismiss(item.id)}
                              className="text-xs text-gray-400 dark:text-app-muted hover:text-gray-700 dark:hover:text-white px-2"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
