import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--surface-page)",
        card: "var(--surface-card)",
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          light: "var(--brand-light)",
          surface: "var(--brand-surface)",
        },
        border: {
          DEFAULT: "var(--border)",
          soft: "var(--border-soft)",
        },
        success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
        error: { bg: "var(--error-bg)", fg: "var(--error-fg)" },
        warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
      },
      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        muted: "var(--text-muted)",
        "on-brand": "var(--text-on-brand)",
      },
      fontFamily: {
        content: "var(--font-content)",
        ui: "var(--font-ui)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
