import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { viewportOnce } from "./motionVariants";

const BADGES = [
  { label: "React 19", tip: "Modern component-based UI, the app's entire frontend." },
  { label: "FastAPI", tip: "High-performance async Python backend serving every endpoint." },
  { label: "PostgreSQL", tip: "Production-grade relational database (Neon, serverless)." },
  { label: "Prophet ML", tip: "30-day spending forecasts with confidence intervals." },
  { label: "FAISS", tip: "Vector similarity search for instant merchant categorization." },
  { label: "Scikit-learn", tip: "Isolation Forest anomaly detection trained on your own transactions." },
  { label: "Groq LLM", tip: "Ultra-fast inference powering the AI chat assistant." },
  { label: "RAG Pipeline", tip: "Retrieves your real financial context + Indian finance knowledge before every AI answer." },
];

const STATS = [
  { end: 270, suffix: "+", label: "merchants recognized" },
  { end: 68, suffix: "", label: "Indian finance knowledge chunks" },
  { end: 15, suffix: "+", label: "automated tests" },
  { end: 5, suffix: "", label: "bank formats supported" },
];

function useCountUp(end, trigger) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let cur = 0;
    const step = end / 40;
    const id = setInterval(() => {
      cur += step;
      if (cur >= end) {
        setVal(end);
        clearInterval(id);
      } else {
        setVal(Math.floor(cur));
      }
    }, 25);
    return () => clearInterval(id);
  }, [trigger, end]);
  return val;
}

function StatItem({ end, suffix, label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const val = useCountUp(end, inView);
  return (
    <div ref={ref} className="text-center">
      <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        {val}
        {suffix}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-app-muted">{label}</p>
    </div>
  );
}

function Badge({ label, tip }) {
  return (
    <div className="group relative">
      <span className="inline-flex cursor-default items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-app-accent/40 dark:border-white/10 dark:bg-app-card dark:text-gray-200">
        {label}
      </span>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] leading-snug text-gray-600 shadow-lg group-hover:block dark:border-white/10 dark:bg-app-surface dark:text-gray-300">
        {tip}
      </div>
    </div>
  );
}

export default function TechCredibility() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
            Built with production-grade AI
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 flex flex-wrap justify-center gap-2.5"
        >
          {BADGES.map((b) => (
            <Badge key={b.label} {...b} />
          ))}
        </motion.div>

        <div className="mt-10 grid grid-cols-2 gap-6 border-t border-gray-100 pt-8 dark:border-white/[0.06] sm:grid-cols-4">
          {STATS.map((s) => (
            <StatItem key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
