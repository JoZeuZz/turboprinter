import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0f0f11",
        surface: "#1a1a1e",
        "surface-2": "#25252b",
        border: "#2e2e36",
        accent: "#6366f1",
        "accent-hover": "#818cf8",
        muted: "#6b7280",
        foreground: "#f4f4f5",
      },
    },
  },
  plugins: [],
} satisfies Config;
