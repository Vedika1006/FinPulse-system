import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import API from "../api/axios";

// ── Reason severity ──────────────────────────────────────────
function getReasonVariant(reason) {
  const l = (reason || "").toLowerCase();
  if (l.includes("overspent") || l.includes("exceeded") || l.includes("risk") || l.includes("high"))
    return "danger";
  if (l.includes("close") || l.includes("approaching") || l.includes("no budget") || l.includes("warning"))
    return "warning";
  return "success";
}

// ── Parse raw AI lines into 4 named fields ───────────────────
function parseInsights(insights = []) {
  const data = { insight: "", risk: "", reason: "", action: "" };
  for (const line of insights) {
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) continue;
    const value = rest.join(":").trim();
    const k     = key.trim().toLowerCase();
    if (k.includes("insight"))                                                           data.insight = value;
    else if (k.includes("risk"))                                                         data.risk    = value;
    else if (k.includes("reason"))                                                       data.reason  = value;
    else if (k === "action" || k.includes("suggested action") || k.includes("suggestion"))
                                                                                         data.action  = value;
  }
  return data;
}

function calculateScore({ insight, risk, reason, action }) {
  let s = 80;
  if (risk?.toLowerCase().includes("high"))                                              s -= 25;
  if (insight?.toLowerCase().includes("exceeded") || insight?.toLowerCase().includes("over")) s -= 10;
  if (reason?.toLowerCase().includes("over"))                                            s -= 5;
  if (action?.toLowerCase().includes("reduce"))                                          s -= 5;
  return Math.max(30, Math.min(s, 100));
}

// ── Score card ────────────────────────────────────────────────
function ScoreCard({ score }) {
  const cfg =
    score >= 80 ? { label: "Excellent",  color: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" } :
    score >= 60 ? { label: "Good",       color: "text-cyan-600 dark:text-cyan-400",       bar: "bg-cyan-500"    } :
    score >= 40 ? { label: "Fair",       color: "text-amber-600 dark:text-amber-400",     bar: "bg-amber-500"   } :
                  { label: "Needs work", color: "text-red-600 dark:text-red-400",         bar: "bg-red-500"     };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-app-card">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-app-muted">
        Financial Health Score
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-3xl font-semibold tabular-nums ${cfg.color}`}>{score}</span>
        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Left-border accent colour per insight type ───────────────
const BLOCK_BORDER = {
  insight:    "border-l-4 border-l-cyan-500",
  risk:       "border-l-4 border-l-red-500",
  pattern:    "border-l-4 border-l-violet-500",
  suggestion: "border-l-4 border-l-emerald-500",
};

// ── InsightBlock — DISPLAY ONLY ──────────────────────────────
// Previously each block rendered action buttons and a
// "This action will help reduce your risk" line.
// Problems:
//  1. "View Analytics" on Analytics page linked back to itself
//  2. Same buttons appeared twice
//  3. Generic helper text appeared 4 times identically
// Fix: display-only. No buttons, no helper text.
function InsightBlock({ title, value, type }) {
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-app-card ${
        BLOCK_BORDER[type] || ""
      }`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-app-muted">
        {title}
      </p>
      <p className="text-sm leading-relaxed text-gray-800 dark:text-app-subtle">
        {value || "No data available"}
      </p>
    </div>
  );
}

function InsightGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-app-card"
        >
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="mb-1.5 h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
// NEW PROP: compact (default false)
//
// compact=false  Full mode. Shows ScoreCard + savings rate +
//                "Why this score?" + 4 insight cards.
//                Used anywhere outside Analytics.jsx.
//
// compact=true   Analytics mode. Skips ScoreCard, savings rate,
//                "Why this score?", and the memory line — because
//                Analytics.jsx shows those in its own hero strip
//                directly above this component.
export function AIFinancialInsights({
  insights = [],
  loading  = false,
  health   = null,
  compact  = false,
}) {
  const parsed      = parseInsights(insights);
  const score       = Number(health?.score ?? health?.health_score ?? calculateScore(parsed));
  const reasons     = Array.isArray(health?.reasons)
    ? health.reasons.filter((r) => typeof r === "string" && r.trim())
    : [];
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
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI
          </span>
        }
      />

      <CardBody className="space-y-4">

        {/* ── Full mode only: memory hint ─────────────────
            Skipped in compact mode — Analytics.jsx already
            shows "Pattern: X in Y" in the page subtitle.    */}
        {!compact && memory?.frequent_category && (
          <p className="text-xs text-gray-500 dark:text-app-muted">
            Based on your past behavior:{" "}
            <span className="font-medium text-gray-700 dark:text-app-subtle">
              {memory.habit} in {memory.frequent_category}
            </span>
          </p>
        )}

        {/* ── Full mode only: ScoreCard + savings + reasons ─
            Skipped in compact mode — Analytics.jsx renders
            a 4-stat hero strip that shows these at the top.  */}
        {!compact && (
          <div className="space-y-3">
            <ScoreCard score={score} />

            {savingsRate != null && (
              <p className="text-xs text-gray-500 dark:text-app-muted">
                Savings rate:{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {savingsRate.toFixed(1)}%
                </span>
              </p>
            )}

            {reasons.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-app-card">
                <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                  Why this score?
                </p>
                <div className="space-y-2">
                  {reasons.slice(0, 4).map((r, i) => {
                    const variant = getReasonVariant(r);
                    const cls = {
                      success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
                      warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
                      danger:  "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
                    }[variant];
                    const dot = { success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500" }[variant];
                    return (
                      <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-xs ${cls}`}>
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                        <span className="leading-relaxed">{r}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4 insight cards — both modes ─────────────────
            Display-only. No action buttons.                  */}
        {loading ? (
          <InsightGridSkeleton />
        ) : insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
            <p className="text-sm font-medium text-gray-700 dark:text-app-subtle">
              No insights available
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">
              Add expenses and budgets to unlock AI insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InsightBlock title="Insight"  value={parsed.insight} type="insight"    />
            <InsightBlock title="Risk"     value={parsed.risk}    type="risk"       />
            <InsightBlock title="Reason"   value={parsed.reason}  type="pattern"    />
            <InsightBlock title="Action"   value={parsed.action}  type="suggestion" />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
