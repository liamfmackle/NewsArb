import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        background: "#0a0a0a",
        foreground: "#ffffff",

        // Gold accent
        gold: {
          DEFAULT: "#d4af37",
          dim: "#a08928",
          glow: "rgba(212, 175, 55, 0.3)",
          muted: "rgba(212, 175, 55, 0.6)",
        },

        // Surfaces
        surface: {
          DEFAULT: "#111111",
          secondary: "#1a1a1a",
          tertiary: "#222222",
        },

        // Text
        muted: {
          DEFAULT: "#888888",
          foreground: "#666666",
        },

        // Semantic
        border: "#222222",
        input: "#1a1a1a",
        ring: "#d4af37",

        // Status
        success: "#22c55e",
        destructive: "#dc2626",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },

      letterSpacing: {
        wide: "0.1em",
        wider: "0.15em",
        widest: "0.2em",
      },

      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },

      keyframes: {
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(212, 175, 55, 0.2)",
          },
          "50%": {
            boxShadow: "0 0 30px rgba(212, 175, 55, 0.4)",
          },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },

      boxShadow: {
        glow: "0 0 20px rgba(212, 175, 55, 0.3)",
        "glow-lg": "0 0 40px rgba(212, 175, 55, 0.4)",
        "glow-sm": "0 0 10px rgba(212, 175, 55, 0.2)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
