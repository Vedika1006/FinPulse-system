/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#0F1226",
          surface: "#171A35",
          card: "#1E2247",
          primary: "#3A3F9F",
          secondary: "#6A5AE0",
          accent: "#5B6CFF",
          highlight: "#8A7CFF",
          ink: "#FFFFFF",
          muted: "#9AA3B2",
          subtle: "#C9D1E3",
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(91, 108, 255, 0.35)",
        "glow-sm": "0 0 24px -8px rgba(106, 90, 224, 0.4)",
        "glow-active": "0 0 28px -6px rgba(138, 124, 255, 0.55)",
      },
    },
  },
  plugins: [],
};
