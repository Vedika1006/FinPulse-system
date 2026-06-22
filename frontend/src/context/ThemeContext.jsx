import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const getInitialTheme = () => {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return "light";
};

export const CURRENCIES = [
  { code: "INR", symbol: "₹", locale: "en-IN" },
  { code: "USD", symbol: "$", locale: "en-US" },
  { code: "EUR", symbol: "€", locale: "en-IE" },
  { code: "GBP", symbol: "£", locale: "en-GB" },
];

const getInitialCurrency = () => {
  return localStorage.getItem("expense_app_currency") || "INR";
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [currency, setCurrency] = useState(getInitialCurrency);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("expense_app_currency", currency);
  }, [currency]);

  const currencySymbol = useMemo(() => {
    const found = CURRENCIES.find((c) => c.code === currency);
    return found ? found.symbol : "₹";
  }, [currency]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
      currency,
      setCurrency,
      currencySymbol,
    }),
    [theme, currency, currencySymbol]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
