import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { useNavigate } from "react-router-dom";
import { mapInsightToActions } from "../utils/mapInsightToActions";
import API from "../api/axios";

function getReasonVariant(reason) {
  const lower = (reason || "").toLowerCase();
  if (lower.includes('overspent') || lower.includes('exceeded') || lower.includes('risk') || lower.includes('high')) return 'danger';
  if (lower.includes('close') || lower.includes('approaching') || lower.includes('no budget') || lower.includes('warning')) return 'warning';
  return 'success';
}

/**
 * Parse AI response into structured object
 */
function parseInsights(insights = []) {
  const data = {
    insight: "",
    risk: "",
    reason: "",
    action: "",
  };

  insights.forEach((line) => {
    if (!line) return;

    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) return;

    const value = rest.join(":").trim();
    const normalized = key.trim().toLowerCase();

    if (normalized.includes("insight")) data.insight = value;
    else if (normalized.includes("risk")) data.risk = value;
    else if (normalized.includes("reason")) data.reason = value;
    else if (normalized === "action" || normalized.includes("suggested action") || normalized.includes("suggestion"))
      data.action = value;
  });

  return data;
}

function calculateScore({ insight, risk, reason, action }) {
  // Fallback heuristic only (prefer real backend health score when available)
  let score = 80;
  if (risk?.toLowerCase().includes("high")) score -= 25;
  if (insight?.toLowerCase().includes("exceeded") || insight?.toLowerCase().includes("over")) score -= 10;
  if (reason?.toLowerCase().includes("over")) score -= 5;
  if (action?.toLowerCase().includes("reduce")) score -= 5;
  return Math.max(30, Math.min(score, 100));
}

function ScoreCard({ score }) {
  let status = "Excellent";
  let colorClass = "text-emerald-700 dark:text-emerald-400";

  if (score < 80) {
    status = "Good";
    colorClass = "text-blue-700 dark:text-blue-400";
  }
  if (score < 60) {
    status = "Warning";
    colorClass = "text-amber-700 dark:text-amber-400";
  }
  if (score < 40) {
    status = "Critical";
    colorClass = "text-red-700 dark:text-red-400";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1E2247]">
      <p className="mb-2 text-xs font-medium text-gray-500 dark:text-app-muted">Financial Health Score</p>

      <div className="flex items-center justify-between">
        <h2 className={`text-3xl font-semibold ${colorClass}`}>{score}</h2>
        <span className={`text-sm font-semibold ${colorClass}`}>{status}</span>
      </div>

      <div className="mt-4 h-2 w-full rounded-full bg-gray-200 dark:bg-white/10">
        <div className="h-2 rounded-full bg-blue-600 dark:bg-indigo-500" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

const blockStyles = {
  insight: "border-l-4 border-l-blue-600",
  risk: "border-l-4 border-l-red-600",
  pattern: "border-l-4 border-l-indigo-600",
  suggestion: "border-l-4 border-l-emerald-600",
};

function InsightBlock({ title, value, type }) {
  const navigate = useNavigate();
  const actions = mapInsightToActions(value);

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/5 ${blockStyles[type]}`}
    >
      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-app-muted">{title}</p>
      <p className="text-sm leading-relaxed text-gray-900 dark:text-white">{value || "No data available"}</p>

      {value ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-3">
            {actions.map((a) => (
              <button
                key={`${a.label}-${a.to}`}
                type="button"
                onClick={() => navigate(a.to)}
                className={
                  a.type === "primary"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                }
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-700 dark:text-white/80">This action will help reduce your risk</p>
        </div>
      ) : null}
    </div>
  );
}

function InsightGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function AIFinancialInsights({ insights = [], loading = false, health = null }) {
  const parsed = parseInsights(insights);
  const score = Number(health?.score ?? health?.health_score ?? calculateScore(parsed));
  const reasons = Array.isArray(health?.reasons) ? health.reasons.filter((r) => typeof r === "string" && r.trim()) : [];
  const savingsRate = typeof health?.savings_rate === "number" ? health.savings_rate : null;
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/analytics/memory/");
        setMemory(res.data || null);
      } catch {
        setMemory(null);
      }
    })();
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="AI Financial Insights"
        subtitle="Personalized signals from your spending and budgets"
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-app-accent/30 dark:bg-app-primary/40 dark:text-app-highlight">
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </span>
        }
      />

      <CardBody className="space-y-6">
        <p className="text-xs font-medium text-gray-700 dark:text-white/80">
          Based on your recent transactions and budgets
        </p>
        {memory?.frequent_category ? (
          <p className="text-xs font-medium text-gray-700 dark:text-white/80">
            Based on your past behavior: {memory.habit} in <span className="font-semibold">{memory.frequent_category}</span>.
          </p>
        ) : null}
        <div className="space-y-4">
          <ScoreCard score={score} />
          {savingsRate != null ? (
            <p className="text-xs font-medium text-gray-700 dark:text-white/80">
              Savings rate: <span className="font-semibold">{savingsRate.toFixed(1)}%</span>
            </p>
          ) : null}
          {reasons.length ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Why this score?</p>
              <div className="mt-3 space-y-2">
                {reasons.slice(0, 4).map((r, i) => {
                  const variant = getReasonVariant(r);
                  const styles = {
                    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
                    warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
                    danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300 border-red-200 dark:border-red-500/20",
                  }[variant];
                  
                  const dotStyles = {
                    success: "bg-emerald-500",
                    warning: "bg-amber-500",
                    danger: "bg-red-500",
                  }[variant];

                  return (
                    <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${styles}`}>
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles}`} aria-hidden />
                      <span className="font-medium leading-relaxed">{r}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-app-muted">Generating insights...</p>
            <InsightGridSkeleton />
          </div>
        ) : insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center dark:border-white/15 dark:bg-white/[0.04]">
            <p className="text-sm font-medium text-gray-900 dark:text-app-subtle">No insights available</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-app-muted">
              Add expenses and budgets to unlock AI insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InsightBlock title="Insight" value={parsed.insight} type="insight" />
            <InsightBlock title="Risk" value={parsed.risk} type="risk" />
            <InsightBlock title="Reason" value={parsed.reason} type="pattern" />
            <InsightBlock title="Action" value={parsed.action} type="suggestion" />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
