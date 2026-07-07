import { motion } from "framer-motion";
import { Upload, Sparkles, Target } from "lucide-react";
import { viewportOnce } from "./motionVariants";

const STEPS = [
  {
    icon: Upload,
    title: "Import or Add",
    desc: "Upload your bank statement CSV or add expenses with voice, text, or receipt photo. Works with ICICI, HDFC, SBI.",
  },
  {
    icon: Sparkles,
    title: "AI Analyzes",
    desc: "FinPulse categorizes, detects patterns, spots anomalies, and builds your financial profile — automatically.",
  },
  {
    icon: Target,
    title: "You Act",
    desc: "Get personalized suggestions, budget alerts, savings goals, and tax optimization tips. One action at a time.",
  },
];

const stepVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.35, ease: "easeOut" },
  }),
};

const lineVariant = {
  hidden: { scaleX: 0 },
  visible: (i) => ({
    scaleX: 1,
    transition: { duration: 0.5, delay: i * 0.35 + 0.3, ease: "easeOut" },
  }),
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-gray-50 py-24 dark:bg-app-surface">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            From expense to insight in 10 seconds
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          {/* Connecting line segments — desktop only, draw themselves in sequentially */}
          <div className="pointer-events-none absolute top-7 left-[calc(16.6%+28px)] right-[calc(16.6%+28px)] hidden sm:grid sm:grid-cols-2" aria-hidden>
            {[0, 1].map((i) => (
              <motion.div
                key={i}
                custom={i}
                variants={lineVariant}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                style={{ transformOrigin: "left" }}
                className="h-px bg-gradient-to-r from-cyan-400 to-violet-400 dark:from-cyan-600 dark:to-violet-600"
              />
            ))}
          </div>

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                custom={i}
                variants={stepVariant}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="flex flex-col items-center text-center"
              >
                <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-app-card">
                  <Icon className="h-6 w-6 text-app-accent" />
                </div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-app-muted">
                  Step {i + 1}
                </p>
                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                <p className="max-w-[240px] text-sm leading-relaxed text-gray-500 dark:text-app-muted">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
