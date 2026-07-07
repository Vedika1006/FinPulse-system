// Shared scroll-triggered animation variants for the landing page.
// Use with: <motion.div variants={fadeUp} initial="hidden" whileInView="visible"
//   viewport={{ once: true, amount: 0.3 }} custom={index} />

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.15, ease: "easeOut" },
  }),
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" },
  }),
};

// For the alternating feature rows — visual slides in from its own side.
export const slideFromSide = (fromRight) => ({
  hidden: { opacity: 0, x: fromRight ? 40 : -40, rotate: 0 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
});

export const viewportOnce = { once: true, amount: 0.3 };
