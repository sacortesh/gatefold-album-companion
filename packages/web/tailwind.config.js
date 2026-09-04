/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        ink: "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        primary: {
          DEFAULT: "var(--color-primary)",
          ink: "var(--color-primary-ink)",
        },
        banger: "var(--color-banger)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        display: ["Spectral", "serif"],
        sans: ["Public Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.4" }], // 12px
        sm: ["0.833rem", { lineHeight: "1.4" }], // 13.3px
        base: ["1rem", { lineHeight: "1.5" }], // 16px
        lg: ["1.2rem", { lineHeight: "1.4" }], // 19.2px
        xl: ["1.44rem", { lineHeight: "1.3" }], // 23px
        "2xl": ["1.728rem", { lineHeight: "1.2" }], // 27.6px
        "3xl": ["2.074rem", { lineHeight: "1.15" }], // 33.2px
      },
      borderRadius: {
        // md (buttons/inputs/pills) stays Tailwind's default 6px; lg
        // (cards/panels/hero art frame) is the only override needed —
        // DESIGN.md's Components section locks these as the only two radii.
        lg: "10px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
