import { Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { useNavigate } from "react-router-dom";
import { mapInsightToActions } from "../utils/mapInsightToActions";
import API from "../api/axios";

function getReasonVariant(reason) {
  const lower = (reason || "").toLowerCase();
  if (lower.includes("overspent") || lower.includes("exceeded") || lower.includes("risk") || lower.includes("high"))
    return "danger";
  if (lower.includes("close") || lower.includes("approaching") || lower.includes("no budget") || lower.includes("warning"))
    return "warning";
  return "success";
}

function parseInsights(insights = []) {
  const data = { insight: "", risk: "", reason: "", action: "" };
  insights.forEach((line) => {
    if (!line) return;
    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) return;
    const value      = rest.join(":").trim();
    const normalized = key.trim().toLowerCase();
    if (normalized.includes("insight")) data.insight = value;
    else if (normalized.includes("risk")) data.risk = value;
    else if (normalized.includes("reason")) data.reason = value;
    else if (normalized === "action" || normalized.includes("suggested action") || normalized.includes("suggestion"))
      data.action = value;
  });
  return data;
}

// ── ScoreCard ─────────────────────────────────────────────
// Only rendered when hasIncome && hasBudgets are both true.
// Without income the savings-rate math is nonsensical (income=0
// makes every rupee spent look like a 100%+ deficit).
function ScoreCard({ score }) {
  let status    = "Excellent";
  let colorCls  = "text-emerald-700 dark:text-emerald-400";
  let barColor  = "bg-emerald-500";

  if (score < 80) { status = "Good";     colorCls = "text-cyan-700 dark:text-cyan-400";   barColor = "bg-cyan-500"; }
  if (score < 60) { status = "Warning";  colorCls = "text-amber-700 dark:text-amber-400"; barColor = "bg-amber-500"; }
  if (score < 40) { status = "Critical"; colorCls = "text-red-700 dark:text-red-400";     barColor = "bg-red-500"; }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-app-card">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
        Financial Health Score
      </p>
      <div className="flex items-center justify-between">
        <h2 className={`text-3xl font-semibold tabular-nums ${colorCls}`}>{score}</h2>
        <span className={`text-sm font-semibold ${colorCls}`}>{status}</span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
        <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

const blockStyles = {
  insight:    "border-l-4 border-l-cyan-500",
  risk:       "border-l-4 border-l-red-500",
  pattern:    "border-l-4 border-l-violet-500",
  suggestion: "border-l-4 border-l-emerald-500",
};

function InsightBlock({ title, value, type }) {
  const navigate = useNavigate();
  const actions  = mapInsightToActions(value);

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-white/[0.06] dark:bg-app-card ${blockStyles[type]}`}>
      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-app-muted">{title}</p>
      <p className="text-sm leading-relaxed text-gray-900 dark:text-white">{value || "No data available"}</p>
      {value ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={`${a.label}-${a.to}`}
              type="button"
              onClick={() => navigate(a.to)}
              className={
                a.type === "primary"
                  ? "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400"
                  : "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-transparent dark:text-white dark:hover:bg-white/5"
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InsightGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-app-card">
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Props:
//   hasIncome  — user has at least one income record
//   hasBudgets — user has at least one budget set
// When either is false we hide the health score and insight
// cards entirely and replace them with a friendly prompt.
// ─────────────────────────────────────────────────────────
export function AIFinancialInsights({
  insights   = [],
  loading    = false,
  health     = null,
  hasIncome  = false,
  hasBudgets = false,
}) {
  const parsed      = parseInsights(insights);
  const score       = Number(health?.score ?? health?.health_score ?? 0);
  const reasons     = Array.isArray(health?.reasons)
    ? health.reasons.filter((r) => typeof r === "string" && r.trim())
    : [];
  const savingsRate = typeof health?.savings_rate === "number" ? health.savings_rate : null;
  const [memory, setMemory] = useState(null);

  // Data is only meaningful when BOTH income AND budgets exist.
  // Without income  → savings rate = 0/0 → nonsensical
  // Without budgets → every rupee spent is "over budget"
  const dataComplete = hasIncome && hasBudgets;

  useEffect(() => {
    (async () => {
      try { const res = await API.get("/analytics/memory/"); setMemory(res.data || null); }
      catch { setMemory(null); }
    })();
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="AI Financial Insights"
        subtitle="Personalized signals from your spending and budgets"
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </span>
        }
      />

      <CardBody className="space-y-6">
        {/* ── Incomplete data gate ────────────────────────
            When income or budgets are missing we show a
            setup prompt instead of the misleading score +
            "you overspent by ₹X" cards.
        ────────────────────────────────────────────────── */}
        {!dataComplete ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-white/[0.10] dark:bg-white/[0.03]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-500/10">
              <TrendingUp className="h-6 w-6 text-cyan-500" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Complete your setup to unlock insights
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">
                {!hasIncome && !hasBudgets
                  ? "Add your monthly income and create at least one budget category to see your real financial health score."
                  : !hasIncome
                  ? "Add your monthly income so FinPulse can calculate your savings rate and generate accurate insights."
                  : "Create at least one budget category so FinPulse knows how to evaluate your spending."}
              </p>
            </div>
          </div>
        ) : (
          /* ── Full insights when data is complete ──── */
          <>
            {memory?.frequent_category ? (
              <p className="text-xs font-medium text-gray-700 dark:text-white/80">
                Based on your past behavior: {memory.habit} in{" "}
                <span className="font-semibold">{memory.frequent_category}</span>.
              </p>
            ) : null}

            <div className="space-y-4">
              <ScoreCard score={score} />

              {savingsRate != null ? (
                <p className="text-xs font-medium text-gray-700 dark:text-white/80">
                  Savings rate:{" "}
                  <span className="font-semibold">{savingsRate.toFixed(1)}%</span>
                </p>
              ) : null}

              {reasons.length > 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-white/5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Why this score?</p>
                  <div className="mt-3 space-y-2">
                    {reasons.slice(0, 4).map((r, i) => {
                      const variant = getReasonVariant(r);
                      const styles = {
                        success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
                        warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
                        danger:  "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300 border-red-200 dark:border-red-500/20",
                      }[variant];
                      const dotStyles = {
                        success: "bg-emerald-500",
                        warning: "bg-amber-500",
                        danger:  "bg-red-500",
                      }[variant];
                      return (
                        <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm ${styles}`}>
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
                <p className="text-sm text-gray-600 dark:text-app-muted">Generating insights…</p>
                <InsightGridSkeleton />
              </div>
            ) : insights.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center dark:border-white/[0.10] dark:bg-white/[0.04]">
                <p className="text-sm font-medium text-gray-900 dark:text-app-subtle">No insights yet</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-app-muted">
                  Add more expenses to unlock AI-powered spending insights.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InsightBlock title="Insight" value={parsed.insight} type="insight" />
                <InsightBlock title="Risk"    value={parsed.risk}    type="risk" />
                <InsightBlock title="Reason"  value={parsed.reason}  type="pattern" />
                <InsightBlock title="Action"  value={parsed.action}  type="suggestion" />
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
