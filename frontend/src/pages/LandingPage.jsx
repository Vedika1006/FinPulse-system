import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useInView, useAnimation, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import AuthModal from "../components/AuthModal";

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(end, trigger) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let cur = 0;
    const step = end / 60;
    const id = setInterval(() => {
      cur += step;
      if (cur >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(cur));
    }, 30);
    return () => clearInterval(id);
  }, [trigger, end]);
  return val;
}

// ─── Stat card (defined at module level so it is stable between renders) ─────
function StatCard({ prefix, suffix, end, label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const val = useCountUp(end, inView);
  return (
    <div ref={ref} className="px-6 py-4 text-center">
      <p className="font-mono text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl">
        {prefix || ""}{val}{suffix || ""}
      </p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ─── Landing page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("login");

  const openModal = (mode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  // Arriving via a redirect like /?auth=login (e.g. after logging out, or
  // an old /login bookmark) should open the modal in that mode immediately.
  useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login" || authParam === "signup") {
      setModalMode(authParam);
      setModalOpen(true);
    }
  }, [searchParams]);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-[#080C14] dark:text-white">

      {/* ── CSS keyframes for floating ₹ symbols ── */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0px);   opacity: 0.04; }
          50%  {                                opacity: 0.07; }
          100% { transform: translateY(-40px); opacity: 0.04; }
        }
        .rp { animation: floatUp ease-in-out infinite; }
      `}</style>

      {/* ══════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════ */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-md dark:border-white/[0.06] dark:bg-[#080C14]/80"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-[10px] font-bold text-[#06080F]">
              FP
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-gray-900 dark:text-white">FinPulse</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Intelligence
              </p>
            </div>
          </div>

          {/* Center links */}
          <div className="hidden items-center gap-6 sm:flex">
            {[["Features","features"],["How it works","how"],["About","stats"]].map(([lbl, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => openModal("login")}
              className="hidden rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 sm:block"
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => openModal("signup")}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-[#06080F] transition hover:bg-cyan-400 active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </div>
      </motion.nav>

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section
        id="hero"
        className="relative flex min-h-screen items-center overflow-hidden bg-gradient-to-br from-white via-cyan-50/20 to-blue-50/10 dark:from-[#080C14] dark:to-[#0a1630]"
      >
        {/* Floating ₹ symbols — CSS animation */}
        {[
          { left:"7%",  top:"18%", size:52, dur:"5s",   delay:"0s"   },
          { left:"14%", top:"72%", size:68, dur:"6.5s", delay:"1.2s" },
          { left:"79%", top:"12%", size:58, dur:"5.5s", delay:"0.4s" },
          { left:"86%", top:"65%", size:76, dur:"7s",   delay:"1.8s" },
          { left:"52%", top:"82%", size:44, dur:"4.5s", delay:"0.9s" },
          { left:"33%", top:"8%",  size:84, dur:"6s",   delay:"2.1s" },
        ].map((f, i) => (
          <span
            key={i}
            className="rp pointer-events-none absolute select-none font-bold text-cyan-500"
            style={{
              left: f.left,
              top: f.top,
              fontSize: f.size,
              animationDuration: f.dur,
              animationDelay: f.delay,
            }}
          >
            ₹
          </span>
        ))}

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 py-28 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-36">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3.5 py-1.5 dark:border-cyan-500/20 dark:bg-cyan-500/10">
              <span className="text-cyan-500">✦</span>
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                AI-Powered Finance
              </span>
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-[1.12] tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              Your money,{" "}
              <br className="hidden sm:block" />
              finally{" "}
              <span className="text-cyan-500">understood</span>
            </h1>

            <p className="mb-8 max-w-lg text-base leading-relaxed text-gray-600 dark:text-gray-400 sm:text-lg">
              FinPulse uses ML anomaly detection, Prophet forecasting, and AI chat
              to give you a financial intelligence layer — built for India.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openModal("signup")}
                className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400"
              >
                Start for free
              </button>
              <button
                type="button"
                onClick={() => scrollTo("features")}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              >
                See how it works →
              </button>
            </div>

            <p className="mt-5 text-xs text-gray-400 dark:text-gray-600">
              No credit card · Free forever · Made for India 🇮🇳
            </p>
          </motion.div>

          {/* Right — browser mockup */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.25 }}
            className="hidden lg:block"
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1420] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)]">
              {/* Browser bar */}
              <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#080C14] px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex-1 rounded-md bg-white/[0.04] px-3 py-1 text-center font-mono text-[9px] text-gray-600">
                  fin-pulse-system.vercel.app
                </div>
              </div>

              {/* Mini dashboard */}
              <div className="space-y-2.5 p-3.5">
                {/* Health score */}
                <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-[#112030] p-3">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-600">
                      Financial Health
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-bold text-emerald-400">71</p>
                    <p className="mt-0.5 text-[9px] text-gray-600">Good · keep it up</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10 font-mono text-sm font-bold text-emerald-400">
                    71
                  </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Income",   "₹85K",   "text-emerald-400"],
                    ["Expenses", "₹5.3K",  "text-orange-400" ],
                    ["Savings",  "₹79.6K", "text-blue-400"   ],
                  ].map(([lbl, val, cls]) => (
                    <div key={lbl} className="rounded-lg border border-white/[0.05] bg-[#112030] p-2">
                      <p className="text-[7px] font-semibold uppercase tracking-wider text-gray-600">{lbl}</p>
                      <p className={`mt-0.5 font-mono text-xs font-bold ${cls}`}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <div className="rounded-xl border border-white/[0.05] bg-[#112030] p-2.5">
                  <p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-gray-600">
                    Monthly Trend
                  </p>
                  <svg viewBox="0 0 220 44" className="w-full" height="36">
                    {[
                      [6,  30, "#06B6D4"],
                      [44, 38, "#F97316"],
                      [82, 22, "#06B6D4"],
                      [120,44, "#06B6D4"],
                      [158,34, "#F97316"],
                      [196,40, "#06B6D4"],
                    ].map(([x, h, c], i) => (
                      <rect key={i} x={x} y={44 - h} width="18" height={h} rx="2" fill={c} fillOpacity="0.75" />
                    ))}
                  </svg>
                </div>

                {/* Alert strip */}
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                  <p className="text-[8px] font-medium text-amber-300">
                    Smart alert: Food spend up 28% this week
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════ */}
      <section id="stats" className="bg-gray-50 py-20 dark:bg-[#0D1420]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-white/[0.08]">
            <StatCard prefix="₹" suffix="L+" end={50} label="tracked by FinPulse users" />
            <StatCard suffix="%" end={98} label="ML categorization accuracy" />
            <StatCard end={3} label="AI models working for you" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════ */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Built different. Built smarter.
            </h2>
            <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
              Three ML models running on every transaction you make.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">

            {/* Card 1 — Anomaly Detection */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/[0.05] dark:bg-[#112030]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
                <span className="relative flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
                </span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Anomaly Detection
              </h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Isolation Forest flags unusual spending before it becomes a problem.
                Trained on YOUR data, not averages.
              </p>
              <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-xs font-medium text-red-700 dark:text-red-300">
                  ₹2,000 on New Furniture · <strong>HIGH</strong>
                </span>
              </div>
            </div>

            {/* Card 2 — 30-Day Forecasting */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/[0.05] dark:bg-[#112030]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-500/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                30-Day Forecasting
              </h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Facebook Prophet predicts your spending 30 days ahead with 80% confidence
                intervals. Know before you overspend.
              </p>
              <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                <svg viewBox="0 0 200 50" className="w-full" height="40">
                  <path
                    d="M0,44 C40,44 60,30 90,28 C120,26 150,16 200,10 L200,18 C150,24 120,34 90,36 C60,38 40,50 0,50 Z"
                    fill="#06B6D4" fillOpacity="0.08"
                  />
                  <path
                    d="M0,44 C40,44 60,30 90,28 C120,26 150,16 200,10"
                    stroke="#06B6D4" strokeWidth="2" fill="none" strokeLinecap="round"
                  />
                </svg>
                <p className="mt-1 text-center text-[10px] text-gray-400 dark:text-gray-600">
                  30-day forecast with 80% confidence band
                </p>
              </div>
            </div>

            {/* Card 3 — Smart Categorization */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/[0.05] dark:bg-[#112030]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Smart Categorization
              </h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                273 Indian merchants pre-embedded. Type 'Swiggy' and it instantly knows
                it's Food — no manual tagging ever.
              </p>
              <div className="mt-5 flex h-11 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 dark:border-white/5 dark:bg-white/[0.02]">
                <span className="font-mono text-sm font-semibold text-violet-600 dark:text-violet-400">
                  Swiggy → Food ✓
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section id="how" className="bg-gray-50 py-24 dark:bg-[#0D1420]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              From expense to insight in 10 seconds
            </h2>
          </div>

          <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            {/* Connecting line — desktop only */}
            <div
              className="pointer-events-none absolute top-7 left-[calc(16.6%+28px)] right-[calc(16.6%+28px)] hidden h-px bg-gradient-to-r from-cyan-200 via-violet-200 to-emerald-200 dark:from-cyan-800/40 dark:via-violet-800/40 dark:to-emerald-800/40 sm:block"
              aria-hidden
            />

            {[
              {
                num: "01",
                icon: "➕",
                title: "Add an expense",
                desc: "Type naturally: 'spent ₹450 at Zomato yesterday'",
              },
              {
                num: "02",
                icon: "⚡",
                title: "AI understands it",
                desc: "FAISS categorizes, Prophet updates forecast, Isolation Forest checks for anomalies",
              },
              {
                num: "03",
                icon: "📈",
                title: "Insights appear",
                desc: "Dashboard updates instantly with new patterns and alerts",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#112030]">
                  <span className="text-xl">{step.icon}</span>
                </div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                  {step.num}
                </p>
                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="max-w-[220px] text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gray-900 py-24 dark:bg-[#112030]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(6,182,212,0.08),transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Ready to understand your money?
          </h2>
          <p className="mb-8 text-base text-gray-400">
            Join thousands of Indians who stopped guessing and started knowing.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openModal("signup")}
              className="rounded-xl bg-cyan-500 px-6 py-3 text-base font-semibold text-[#06080F] shadow-lg transition hover:bg-cyan-400"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={() => openModal("login")}
              className="rounded-xl border border-white/20 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/5"
            >
              Log in
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 bg-white py-8 dark:border-white/[0.06] dark:bg-[#080C14]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-500 text-[8px] font-bold text-[#06080F]">
              FP
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Built with ML for India</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-gray-900 dark:hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </a>
        </div>
      </footer>

      {/* ── Auth Modal ── */}
      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialMode={modalMode}
      />
    </div>
  );
}
