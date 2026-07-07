import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import AuthModal from "../components/AuthModal";
import DashboardMockup from "../components/landing/DashboardMockup";
import FeatureRow from "../components/landing/FeatureRow";
import {
  ExpenseEntryVisual,
  AIChatVisual,
  AnomalyVisual,
  SubscriptionsVisual,
  EMITaxVisual,
} from "../components/landing/FeatureVisuals";
import ProblemSection from "../components/landing/ProblemSection";
import HowItWorks from "../components/landing/HowItWorks";
import TechCredibility from "../components/landing/TechCredibility";
import { fadeUp, viewportOnce } from "../components/landing/motionVariants";

const HEADLINE_WORDS = "You earn well. You still don't know where it goes.".split(" ");

const FEATURES = [
  {
    badge: "Smart Expense Tracking",
    title: "Smart Expense Tracking",
    description:
      "Tell it what you spent — by typing, talking, or uploading a receipt. FinPulse categorizes 270+ Indian merchants instantly. No manual tagging, no spreadsheets.",
    visual: <ExpenseEntryVisual />,
    reverse: true, // visual left, copy right
  },
  {
    badge: "AI That Knows Your Money",
    title: "AI That Knows Your Money",
    description:
      "Not a generic chatbot. FinPulse AI has read your transactions, knows your budgets, and understands Indian tax rules. Ask it anything — it answers with your real numbers.",
    visual: <AIChatVisual />,
    reverse: false, // copy left, visual right
  },
  {
    badge: "Spot Problems Before They Hurt",
    title: "Spot Problems Before They Hurt",
    description:
      "Unusual spending gets flagged automatically using ML anomaly detection. See your spending patterns in a year-long heatmap. No surprise credit card bills.",
    visual: <AnomalyVisual />,
    reverse: true,
  },
  {
    badge: "Bills on Autopilot",
    title: "Bills on Autopilot",
    description:
      "FinPulse detects your recurring payments from transaction patterns. Track them, get reminded before they hit, and know your exact monthly commitment — ₹20,522/month across 5 subscriptions.",
    visual: <SubscriptionsVisual />,
    reverse: false,
  },
  {
    badge: "EMIs, Taxes, Everything",
    title: "EMIs, Taxes, Everything",
    description:
      "Track every EMI with real amortization math. Plan your 80C tax savings and see Old vs New regime compared instantly. Built for Indian financial life, not a generic Western template.",
    visual: <EMITaxVisual />,
    reverse: true,
  },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("login");
  const [scrolled, setScrolled] = useState(false);

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-app-bg dark:text-white">
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
          NAVBAR — transparent at top, blurs + gains a border on scroll
      ══════════════════════════════════════════════════════ */}
      <nav
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? "border-b border-gray-200/60 bg-white/80 backdrop-blur-md dark:border-white/[0.06] dark:bg-app-bg/80"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
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

          <div className="hidden items-center gap-6 sm:flex">
            {[["Features", "features"], ["How it works", "how-it-works"]].map(([lbl, id]) => (
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
      </nav>

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section id="hero" className="relative overflow-hidden">
        {/* Soft gradient mesh background */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-cyan-50/40 dark:from-app-bg dark:via-app-bg dark:to-[#0a1630]" />
          <div className="absolute left-[10%] top-0 h-[420px] w-[420px] rounded-full bg-cyan-200/25 blur-3xl dark:bg-cyan-500/10" />
          <div className="absolute right-0 top-1/3 h-[380px] w-[380px] rounded-full bg-violet-200/20 blur-3xl dark:bg-violet-500/10" />
        </div>

        {/* Floating ₹ symbols — subtle CSS animation */}
        {[
          { left: "7%", top: "18%", size: 52, dur: "5s", delay: "0s" },
          { left: "3%", top: "90%", size: 68, dur: "6.5s", delay: "1.2s" },
          { left: "79%", top: "12%", size: 58, dur: "5.5s", delay: "0.4s" },
          { left: "86%", top: "65%", size: 76, dur: "7s", delay: "1.8s" },
          { left: "52%", top: "82%", size: 44, dur: "4.5s", delay: "0.9s" },
        ].map((f, i) => (
          <span
            key={i}
            className="rp pointer-events-none absolute select-none font-bold text-cyan-500"
            style={{ left: f.left, top: f.top, fontSize: f.size, animationDuration: f.dur, animationDelay: f.delay }}
            aria-hidden
          >
            ₹
          </span>
        ))}

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-28">
          {/* Left — copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3.5 py-1.5 dark:border-cyan-500/20 dark:bg-cyan-500/10"
            >
              <span className="text-cyan-500">✦</span>
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">AI-Powered Personal Finance</span>
            </motion.div>

            <h1 className="mb-5 text-5xl font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white md:text-6xl">
              {HEADLINE_WORDS.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
                  className="mr-[0.28em] inline-block"
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.5 }}
              className="mb-8 max-w-lg text-lg leading-relaxed text-gray-600 dark:text-app-muted"
            >
              FinPulse tracks every rupee, spots problems before you do, and tells you exactly what to do
              next — built for how Indians actually spend.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.62 }}
              className="flex flex-wrap gap-3"
            >
              <button
                type="button"
                onClick={() => openModal("signup")}
                className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-[#06080F] shadow-sm transition hover:bg-cyan-400"
              >
                Start Free
              </button>
              <button
                type="button"
                onClick={() => scrollTo("how-it-works")}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              >
                See How It Works
              </button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.75 }}
              className="mt-5 text-xs text-gray-400 dark:text-gray-600"
            >
              No credit card needed · Works with ICICI, HDFC, SBI statements · 256-bit encryption
            </motion.p>
          </div>

          {/* Right — dashboard mockup, floats/slides in */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            className="flex justify-center lg:justify-end"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          THE PROBLEM
      ══════════════════════════════════════════════════════ */}
      <ProblemSection />

      {/* ══════════════════════════════════════════════════════
          FEATURES — alternating rows
      ══════════════════════════════════════════════════════ */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl space-y-24 px-4 sm:px-6">
          {FEATURES.map((f) => (
            <FeatureRow key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ══════════════════════════════════════════════════════
          TECH CREDIBILITY
      ══════════════════════════════════════════════════════ */}
      <TechCredibility />

      {/* ══════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-500 to-[#0a1630] py-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(255,255,255,0.08),transparent_70%)]"
          aria-hidden
        />
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative mx-auto max-w-2xl px-4 text-center sm:px-6"
        >
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Start understanding your money today
          </h2>
          <p className="mb-8 text-lg text-white/80">
            Free to use. Takes 2 minutes to set up. No bank login required.
          </p>
          <button
            type="button"
            onClick={() => openModal("signup")}
            className="rounded-xl bg-[#06080F] px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-black"
          >
            Get Started Free
          </button>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 bg-white py-8 dark:border-white/[0.06] dark:bg-app-bg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-500 text-[8px] font-bold text-[#06080F]">
                FP
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Vedika Pardeshi
              </span>
            </div>

            <a
              href="https://github.com/Vedika1006/FinPulse-system"
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
          <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-600">
            © {new Date().getFullYear()} FinPulse. Your data stays yours — 256-bit encryption, no third-party sharing.
          </p>
        </div>
      </footer>

      {/* ── Auth Modal ── */}
      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} initialMode={modalMode} />
    </div>
  );
}
