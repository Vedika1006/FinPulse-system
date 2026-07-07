import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "./motionVariants";

// One full-width alternating feature row: copy on one side, a styled
// mockup "visual" on the other. `reverse` flips which side the visual sits
// on (desktop only — copy always comes first on mobile for readability).
export default function FeatureRow({ badge, title, description, visual, reverse = false }) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className={reverse ? "lg:order-2" : "lg:order-1"}
      >
        {badge && (
          <span className="mb-3 inline-block rounded-full bg-app-accent/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-app-accent">
            {badge}
          </span>
        )}
        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{title}</h3>
        <p className="mt-4 text-lg leading-relaxed text-gray-600 dark:text-app-muted">{description}</p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        custom={1}
        className={`flex justify-center ${reverse ? "lg:order-1" : "lg:order-2"}`}
      >
        <div className={`w-full max-w-md transition-transform duration-300 hover:rotate-0 ${reverse ? "-rotate-2" : "rotate-2"}`}>
          {visual}
        </div>
      </motion.div>
    </div>
  );
}
