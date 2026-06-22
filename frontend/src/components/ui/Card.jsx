import { motion } from "framer-motion";

export function Card({ children, className = "", hover = true, ...rest }) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02 } : undefined}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-app-card/80 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] dark:shadow-indigo-500/10 dark:backdrop-blur-xl ${
        hover
          ? "transition-shadow duration-200 hover:shadow-md dark:hover:border-app-accent/25 dark:hover:shadow-glow"
          : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-white/10 ${className}`}
    >
      <div className="text-left">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-gray-600 dark:text-app-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = "" }) {
  return <div className={`px-6 py-6 text-left ${className}`}>{children}</div>;
}
