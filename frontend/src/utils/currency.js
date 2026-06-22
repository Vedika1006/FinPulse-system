import { CURRENCIES } from "../context/ThemeContext";

export function formatCurrency(value, currencyCode = null) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";

  const code = currencyCode || localStorage.getItem("expense_app_currency") || "INR";
  const def = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

  return new Intl.NumberFormat(def.locale, {
    style: "currency",
    currency: def.code,
    maximumFractionDigits: 0,
  }).format(n);
}

export function clampPct(pct) {
  const n = Number(pct);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
