import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#f8fafc",
        ink: "#0b1f3a",
        graphite: "#475569",
        ledger: "#102a56",
        brass: "#f59e0b",
        signal: "#c81e1e",
        pool: "#1d4ed8",
        line: "#dbe4ef"
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "var(--font-body)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 16px 38px rgba(11, 31, 58, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
