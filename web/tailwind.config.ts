import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Luo",
          "Seravek",
          "Candara",
          "Optima",
          '"Iowan Old Style"',
          "Charter",
          "Georgia",
          '"Avenir Next"',
          '"Noto Sans CJK SC"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
