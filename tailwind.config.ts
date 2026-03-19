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
          DEFAULT: "#E50914",
          foreground: "#FFFFFF"
        },
        background: "#000000",
        foreground: "#FFFFFF",
        muted: {
          DEFAULT: "#030712",
          foreground: "#9CA3AF"
        },
        card: {
          DEFAULT: "#050712",
          foreground: "#F9FAFB"
        },
        border: "#1F2933"
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        "soft-glow": "0 0 32px rgba(229, 9, 20, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
