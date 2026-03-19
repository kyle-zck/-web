import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7C3AED",
          foreground: "#F9FAFB"
        },
        background: "#020617",
        foreground: "#F9FAFB",
        muted: {
          DEFAULT: "#020617",
          foreground: "#6B7280"
        },
        card: {
          DEFAULT: "#020617",
          foreground: "#F9FAFB"
        },
        border: "#111827"
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        "soft-glow": "0 0 40px rgba(124, 58, 237, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
