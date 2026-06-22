const DEFAULT_CATEGORIES = [
  "food",
  "shopping",
  "travel",
  "entertainment",
  "bills",
  "rent",
  "groceries",
  "fuel",
  "health",
  "medical",
  "utilities",
  "education",
  "emi",
];

function titleCaseCategory(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function findCategory(text, categories = DEFAULT_CATEGORIES) {
  const t = String(text || "").toLowerCase();
  for (const c of categories) {
    const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
    if (re.test(t)) return c.toLowerCase();
  }
  return null;
}

function uniqByKey(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = `${it?.label || ""}|${it?.to || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * mapInsightToActions(insightText)
 * Returns up to 2 actions with labels + routes.
 *
 * Action shape:
 * { label, type: "primary" | "secondary", to, helperText }
 */
export function mapInsightToActions(insightText, opts = {}) {
  const text = String(insightText || "").trim();
  const month = opts.month ? String(opts.month) : "";

  const actions = [];
  const lower = text.toLowerCase();
  const category = findCategory(text, opts.categories || DEFAULT_CATEGORIES);
  const categoryLabel = category ? titleCaseCategory(category) : null;

  const add = (label, to, type = "primary") => {
    actions.push({
      label,
      to,
      type,
      helperText: "This action will help reduce your risk",
    });
  };

  // Primary intent
  if (lower.includes("budget") || lower.includes("overspend") || lower.includes("over budget") || lower.includes("limit")) {
    if (category) add(`Set ${categoryLabel} Budget`, `/budgets${month ? `?month=${encodeURIComponent(month)}&category=${encodeURIComponent(category)}` : `?category=${encodeURIComponent(category)}`}`, "primary");
    else add("Set Budget", `/budgets${month ? `?month=${encodeURIComponent(month)}` : ""}`, "primary");
  } else if (lower.includes("save") || lower.includes("saving") || lower.includes("savings") || lower.includes("goal")) {
    add("Create Goal", "/budgets", "primary");
  } else if (category) {
    add(`View ${categoryLabel}`, `/expenses?category=${encodeURIComponent(category)}`, "primary");
  } else {
    add("Review Expenses", "/expenses", "primary");
  }

  // Secondary support action
  if (category && !actions.some((a) => a.to.startsWith("/expenses"))) {
    add(`View ${categoryLabel}`, `/expenses?category=${encodeURIComponent(category)}`, "secondary");
  } else if (!actions.some((a) => a.to.startsWith("/budgets"))) {
    add("Set Budget", `/budgets${month ? `?month=${encodeURIComponent(month)}` : ""}`, "secondary");
  } else {
    add("View Analytics", "/analytics", "secondary");
  }

  return uniqByKey(actions).slice(0, 2);
}

