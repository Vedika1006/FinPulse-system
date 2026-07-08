import {
  Home,
  ShoppingCart,
  UtensilsCrossed,
  Zap,
  Car,
  ShoppingBag,
  Film,
  HeartPulse,
  GraduationCap,
  Receipt,
  TrendingUp,
  CreditCard,
  User,
  Plane,
  MoreHorizontal,
} from "lucide-react";

// Single source of truth for the app's expense/budget category taxonomy.
// Every category dropdown and category badge in the app should import from
// here rather than hardcoding its own list, so they can't drift out of sync.
export const CATEGORIES = [
  { value: "Rent",          icon: Home,            color: "blue"    },
  { value: "Groceries",     icon: ShoppingCart,     color: "emerald" },
  { value: "Food",          icon: UtensilsCrossed,  color: "orange"  },
  { value: "Utilities",     icon: Zap,               color: "yellow"  },
  { value: "Transport",     icon: Car,               color: "indigo"  },
  { value: "Shopping",      icon: ShoppingBag,       color: "pink"    },
  { value: "Entertainment", icon: Film,              color: "purple"  },
  { value: "Health",        icon: HeartPulse,        color: "red"     },
  { value: "Education",     icon: GraduationCap,     color: "teal"    },
  { value: "Bills",         icon: Receipt,           color: "gray"    },
  { value: "Investment",    icon: TrendingUp,        color: "green"   },
  { value: "EMI",           icon: CreditCard,        color: "amber"   },
  { value: "Personal",      icon: User,              color: "cyan"    },
  { value: "Travel",        icon: Plane,             color: "sky"     },
  { value: "Other",         icon: MoreHorizontal,    color: "gray"    },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.value);

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value.toLowerCase(), c]));

const FALLBACK = CATEGORY_MAP.other;

/** Case-insensitive lookup — expense/budget category strings from the backend aren't always exact-cased. */
export function getCategoryMeta(name) {
  const key = String(name || "").trim().toLowerCase();
  return CATEGORY_MAP[key] || FALLBACK;
}

// Tailwind can't see dynamically-built class names like `bg-${color}-50` —
// every variant used must appear as a literal string somewhere in the
// source, so this lookup spells each one out in full.
const COLOR_CLASSES = {
  blue:    { bg: "bg-blue-50 dark:bg-blue-500/10",       text: "text-blue-600 dark:text-blue-400"       },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  orange:  { bg: "bg-orange-50 dark:bg-orange-500/10",   text: "text-orange-600 dark:text-orange-400"   },
  yellow:  { bg: "bg-yellow-50 dark:bg-yellow-500/10",   text: "text-yellow-600 dark:text-yellow-400"   },
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-500/10",   text: "text-indigo-600 dark:text-indigo-400"   },
  pink:    { bg: "bg-pink-50 dark:bg-pink-500/10",       text: "text-pink-600 dark:text-pink-400"       },
  purple:  { bg: "bg-purple-50 dark:bg-purple-500/10",   text: "text-purple-600 dark:text-purple-400"   },
  red:     { bg: "bg-red-50 dark:bg-red-500/10",         text: "text-red-600 dark:text-red-400"         },
  teal:    { bg: "bg-teal-50 dark:bg-teal-500/10",       text: "text-teal-600 dark:text-teal-400"       },
  gray:    { bg: "bg-gray-100 dark:bg-white/10",         text: "text-gray-600 dark:text-app-muted"      },
  green:   { bg: "bg-green-50 dark:bg-green-500/10",     text: "text-green-600 dark:text-green-400"     },
  amber:   { bg: "bg-amber-50 dark:bg-amber-500/10",     text: "text-amber-600 dark:text-amber-400"     },
  cyan:    { bg: "bg-cyan-50 dark:bg-cyan-500/10",       text: "text-cyan-600 dark:text-cyan-400"       },
  sky:     { bg: "bg-sky-50 dark:bg-sky-500/10",         text: "text-sky-600 dark:text-sky-400"         },
};

/** Returns { bg, text } Tailwind classes (light + dark) for a category's icon badge. */
export function getCategoryColorClasses(name) {
  const meta = getCategoryMeta(name);
  return COLOR_CLASSES[meta.color] || COLOR_CLASSES.gray;
}
