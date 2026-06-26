/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        app: {
          bg:        "#080C14",
          surface:   "#0D1420",
          card:      "#112030",
          primary:   "#0E4F6E",
          secondary: "#7C3AED",
          accent:    "#06B6D4",
          highlight: "#22D3EE",
          ink:       "#FFFFFF",
          muted:     "#64748B",
          subtle:    "#CBD5E1",
        },
      },
      boxShadow: {
        glow:         "0 0 40px -10px rgba(6, 182, 212, 0.3)",
        "glow-sm":    "0 0 24px -8px rgba(6, 182, 212, 0.35)",
        "glow-active":"0 0 28px -6px rgba(34, 211, 238, 0.45)",
      },
    },
  },
  plugins: [],
};
