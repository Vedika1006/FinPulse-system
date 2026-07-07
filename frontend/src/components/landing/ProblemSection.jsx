import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "./motionVariants";

const PAIN_POINTS = [
  { emoji: "🤷", text: "Where did ₹12,000 go last week?" },
  { emoji: "📊", text: "Spreadsheets that you updated for 3 days and then abandoned" },
  { emoji: "😰", text: "March comes and you've saved nothing for tax" },
];

// Deliberately dark in both themes — a fixed contrast break in the page,
// not something that flips with the light/dark toggle.
export default function ProblemSection() {
  return (
    <section className="bg-gray-900 py-24 dark:bg-app-bg">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mb-10 text-center text-xs font-semibold uppercase tracking-widest text-gray-500"
        >
          Sound familiar?
        </motion.p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PAIN_POINTS.map((p, i) => (
            <motion.div
              key={p.text}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center"
            >
              <span className="mb-4 block text-4xl">{p.emoji}</span>
              <p className="text-lg font-medium leading-snug text-gray-200">{p.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          custom={3}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-12 text-center text-xl font-semibold text-white sm:text-2xl"
        >
          FinPulse does what you keep telling yourself you'll do — but automatically, and better.
        </motion.p>
      </div>
    </section>
  );
}
