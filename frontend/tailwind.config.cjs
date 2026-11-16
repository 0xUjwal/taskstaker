/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface hierarchy — Obsidian dark tonal layering
        "surface": "#000000",
        "surface-dim": "#000000",
        "surface-bright": "#1C1C1E",
        "surface-container-lowest": "#000000",
        "surface-container-low": "#131313",
        "surface-container": "#1B1B1B",
        "surface-container-high": "#2C2C2E",
        "surface-container-highest": "#3A3A3C",
        "surface-variant": "#2C2C2E",
        "surface-tint": "#FF3B30",
        "background": "#000000",

        // Primary — Crimson Red (brand)
        "primary": "#FF3B30",
        "primary-dim": "#D70015",
        "primary-fixed": "#FFDAD4",
        "primary-fixed-dim": "#FFB4A8",
        "primary-container": "#4A0000",
        "on-primary": "#FFFFFF",
        "on-primary-container": "#FFFFFF",
        "on-primary-fixed": "#410000",
        "on-primary-fixed-variant": "#690100",
        "inverse-primary": "#8B0000",

        // Secondary — White/Neutral
        "secondary": "#FFFFFF",
        "secondary-dim": "#A1A1AA",
        "secondary-fixed": "#E4E4E7",
        "secondary-fixed-dim": "#D4D4D8",
        "secondary-container": "#1B1B1B",
        "on-secondary": "#000000",
        "on-secondary-container": "#FFFFFF",
        "on-secondary-fixed": "#27272A",
        "on-secondary-fixed-variant": "#3F3F46",

        // Tertiary — Emerald (success: completed / validated / claimed)
        "tertiary": "#34D399",
        "tertiary-dim": "#059669",
        "tertiary-fixed": "#A7F3D0",
        "tertiary-fixed-dim": "#6EE7B7",
        "tertiary-container": "#064E3B",
        "on-tertiary": "#052E16",
        "on-tertiary-container": "#A7F3D0",
        "on-tertiary-fixed": "#052E16",
        "on-tertiary-fixed-variant": "#065F46",

        // Info — Sky (proof submitted, in-progress)
        "info": "#38BDF8",
        "info-dim": "#0284C7",
        "info-container": "#0C4A6E",

        // Warning — Amber (deadline approaching)
        "warning": "#FBBF24",
        "warning-dim": "#D97706",
        "warning-container": "#451A03",

        // Accent — Iris (aurora gradients, AI)
        "accent": "#A78BFA",
        "accent-dim": "#7C3AED",
        "accent-container": "#2E1065",

        // Error — Bright Red
        "error": "#FF453A",
        "error-dim": "#D70015",
        "error-container": "#4A0000",
        "on-error": "#FFFFFF",
        "on-error-container": "#FFDAD4",

        // On-surface
        "on-surface": "#FFFFFF",
        "on-surface-variant": "#A1A1AA",
        "on-background": "#FFFFFF",
        "inverse-surface": "#FFFFFF",
        "inverse-on-surface": "#1B1B1B",

        // Outline
        "outline": "#3F3F46",
        "outline-variant": "#27272A",
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Manrope", "sans-serif"],
        "label": ["Space Grotesk", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.25rem",
        "full": "9999px",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        "glass-lg": "0 16px 48px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glow-primary": "0 0 24px rgba(255, 59, 48, 0.35)",
        "glow-tertiary": "0 0 24px rgba(52, 211, 153, 0.3)",
        "glow-accent": "0 0 24px rgba(167, 139, 250, 0.3)",
      },
      animation: {
        "aurora-1": "aurora-1 22s ease-in-out infinite alternate",
        "aurora-2": "aurora-2 26s ease-in-out infinite alternate",
        "aurora-3": "aurora-3 30s ease-in-out infinite alternate",
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        "aurora-1": {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(6%, 10%) scale(1.15)" },
          "100%": { transform: "translate(-4%, 4%) scale(1.05)" },
        },
        "aurora-2": {
          "0%": { transform: "translate(0, 0) scale(1.1)" },
          "50%": { transform: "translate(-8%, -6%) scale(1)" },
          "100%": { transform: "translate(5%, -10%) scale(1.2)" },
        },
        "aurora-3": {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-5%, 8%) scale(1.1)" },
          "100%": { transform: "translate(8%, -5%) scale(0.95)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
}
