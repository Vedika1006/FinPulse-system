// Theatrical, looping mini-dashboard for the landing page hero. NOT the real
// dashboard — a ~6s choreographed animation (numbers count up, health ring
// draws, bars grow, an alert slides in, AI types a reply) that demonstrates
// the product at a glance, then holds, fades, and loops. Pure CSS/SVG/Framer
// Motion — no screenshots, no image assets.
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import useCountUp, { easeInOutCubic } from "../../hooks/useCountUp";
import useTypewriter from "../../hooks/useTypewriter";

const INCOME = 72000;
const EXPENSES = 37275;
const SAVINGS = INCOME - EXPENSES;
const HEALTH_SCORE = 78;

const CATEGORIES = [
  { name: "Rent", amount: 18000, color: "#3B82F6", delay: 2.0 },
  { name: "Groceries", amount: 5180, color: "#10B981", delay: 2.2 },
  { name: "Food", amount: 1570, color: "#F97316", delay: 2.4 },
  { name: "Shopping", amount: 3049, color: "#EC4899", delay: 2.6 },
  { name: "Transport", amount: 2380, color: "#6366F1", delay: 2.8 },
];
const MAX_CATEGORY_AMOUNT = Math.max(...CATEGORIES.map((c) => c.amount));

const AI_MESSAGE =
  "You're saving 48% this month — great job! Consider investing ₹5,000 in ELSS for tax savings.";

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1];
const CYCLE_MS = 8000; // Phase 7: reset + loop

const money = (n) => `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`;

function healthTone(score) {
  if (score < 30) return { stroke: "#EF4444", text: "text-red-500 dark:text-red-400", label: "Critical", glow: "rgba(239,68,68,0.45)" };
  if (score < 60) return { stroke: "#F59E0B", text: "text-amber-500 dark:text-amber-400", label: "Fair", glow: "rgba(245,158,11,0.45)" };
  return { stroke: "#10B981", text: "text-emerald-500 dark:text-emerald-400", label: "Good", glow: "rgba(16,185,129,0.45)" };
}

function KpiCard({ label, value, borderClass, textClass, duration, delay, reduceMotion }) {
  const count = useCountUp(value, duration, delay * 1000, undefined, reduceMotion);
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-lg border-l-4 bg-white p-2 shadow-sm dark:bg-[#1a2332] ${borderClass}`}
    >
      <p className="text-[7px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-0.5 font-mono text-[11px] font-bold tabular-nums ${textClass}`}>{money(count)}</p>
    </motion.div>
  );
}

function HealthRing({ reduceMotion }) {
  const score = useCountUp(HEALTH_SCORE, 1500, 1000, easeInOutCubic, reduceMotion);
  const tone = healthTone(score);
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(score, 100) / 100);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 1 }}
      className="flex flex-shrink-0 flex-col items-center justify-center"
    >
      <svg viewBox="0 0 64 64" className="h-14 w-14" style={{ filter: `drop-shadow(0 0 5px ${tone.glow})` }}>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-gray-200 dark:stroke-white/10" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke={tone.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke 0.3s ease" }}
        />
        <text x="32" y="30" textAnchor="middle" className="fill-gray-900 dark:fill-white" style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>
          {score}
        </text>
        <text x="32" y="42" textAnchor="middle" className={tone.text} style={{ fontSize: 7, fontWeight: 700 }}>
          {tone.label}
        </text>
      </svg>
    </motion.div>
  );
}

function CategoryBar({ name, amount, color, delay, reduceMotion }) {
  const widthPct = (amount / MAX_CATEGORY_AMOUNT) * 100;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 flex-shrink-0 truncate text-[7px] font-medium text-gray-500 dark:text-gray-400">{name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-r-md bg-gray-100 dark:bg-white/5">
        <motion.div
          className="h-full rounded-r-md"
          style={{ background: color, width: `${widthPct}%`, transformOrigin: "left" }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay, ease: EASE_OUT_CUBIC }}
        />
      </div>
      <motion.span
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: delay + 0.4 }}
        className="w-11 flex-shrink-0 text-right font-mono text-[7px] font-semibold text-gray-700 dark:text-gray-300"
      >
        {money(amount)}
      </motion.span>
    </div>
  );
}

function AlertCard({ reduceMotion }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 3, type: "spring", stiffness: 320, damping: 16 }}
      className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-500/20 dark:bg-amber-500/10"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ delay: 3.5, duration: 0.7 }}
        className="pointer-events-none absolute inset-0 bg-amber-400/40"
        aria-hidden
      />
      <span className="flex-shrink-0 text-xs leading-none">⚠️</span>
      <p className="flex-1 text-[8px] font-medium text-amber-800 dark:text-amber-300">
        Shopping spike — 3.8× your usual
      </p>
      <span className="flex-shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Medium
      </span>
    </motion.div>
  );
}

function ChatBubble({ reduceMotion }) {
  const { displayed, done } = useTypewriter(AI_MESSAGE, 40, 4100, reduceMotion);
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 3.8 }}
      className="flex items-start gap-2"
    >
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-500">
        <Sparkles className="h-3 w-3 text-white" />
      </span>
      <div className="flex-1 rounded-[11px] bg-gradient-to-r from-teal-400 to-violet-500 p-[1px]">
        <div className="rounded-[10px] bg-white px-2.5 py-1.5 dark:bg-[#1a2332]">
          <p className="min-h-[1.5em] text-[8px] leading-relaxed text-gray-700 dark:text-gray-200">
            {displayed}
            {!done && <span className="ml-0.5 inline-block animate-pulse text-teal-500">▌</span>}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function MiniDashboard({ reduceMotion }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative space-y-2.5 overflow-hidden p-3.5"
    >
      {/* KPIs + health score */}
      <div className="flex items-stretch gap-2">
        <div className="grid flex-1 grid-cols-3 gap-2">
          <KpiCard
            label="Income"
            value={INCOME}
            borderClass="border-l-emerald-500 dark:border-l-emerald-400"
            textClass="text-emerald-600 dark:text-emerald-400"
            duration={1200}
            delay={0}
            reduceMotion={reduceMotion}
          />
          <KpiCard
            label="Expenses"
            value={EXPENSES}
            borderClass="border-l-amber-500 dark:border-l-amber-400"
            textClass="text-amber-600 dark:text-amber-400"
            duration={1000}
            delay={0.2}
            reduceMotion={reduceMotion}
          />
          <KpiCard
            label="Savings"
            value={SAVINGS}
            borderClass="border-l-teal-500 dark:border-l-teal-400"
            textClass="text-teal-600 dark:text-teal-400"
            duration={800}
            delay={0.4}
            reduceMotion={reduceMotion}
          />
        </div>
        <HealthRing reduceMotion={reduceMotion} />
      </div>

      {/* Category bar chart — hidden on mobile to keep the card readable */}
      <div className="hidden space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-white/5 dark:bg-black/20 md:block">
        {CATEGORIES.map((c) => (
          <CategoryBar key={c.name} {...c} reduceMotion={reduceMotion} />
        ))}
      </div>

      {/* Anomaly alert */}
      <AlertCard reduceMotion={reduceMotion} />

      {/* AI chat */}
      <ChatBubble reduceMotion={reduceMotion} />

      {/* Shimmer sweep — plays once near the end of the hold */}
      {!reduceMotion && (
        <motion.div
          initial={{ x: "-120%" }}
          animate={{ x: "120%" }}
          transition={{ delay: 5.5, duration: 0.7, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"
          aria-hidden
        />
      )}
    </motion.div>
  );
}

export default function DashboardMockup() {
  const reduceMotion = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = setTimeout(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => clearTimeout(timer);
  }, [cycle, reduceMotion]);

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_32px_80px_-12px_rgba(0,0,0,0.25)] dark:border-white/10 dark:bg-[#0D1420] dark:shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)] sm:max-w-lg lg:max-w-none">
      {/* Browser bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-white/[0.06] dark:bg-[#080C14]">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex-1 rounded-md bg-gray-100 px-3 py-1 text-center font-mono text-[9px] text-gray-500 dark:bg-white/[0.04] dark:text-gray-500">
          fin-pulse-system.vercel.app
        </div>
      </div>

      {/* Mini dashboard — dashboard body itself, not the frame, holds bg-gray-50/dark bg */}
      <div className="bg-gray-50 dark:bg-[#0f1729]">
        <AnimatePresence mode="wait">
          <MiniDashboard key={cycle} reduceMotion={reduceMotion} />
        </AnimatePresence>
      </div>
    </div>
  );
}
