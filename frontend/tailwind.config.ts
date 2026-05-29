import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d7fe",
          300: "#a5b8fd",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        violet: {
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
      },
      backgroundImage: {
        "sidebar-gradient": "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
        "card-gradient":    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
      boxShadow: {
        "card-lg": "0 4px 24px -2px rgba(99,102,241,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)",
        "glow":    "0 0 20px rgba(99,102,241,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
