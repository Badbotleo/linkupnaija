import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // constants.ts holds class-name maps (category gradients/badges) — without
    // scanning lib, those classes are never generated.
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#534AB7",
          50: "#EEEDF8",
          100: "#DAD8F0",
          200: "#B6B1E1",
          300: "#918AD2",
          400: "#6D63C3",
          500: "#534AB7",
          600: "#433B92",
          700: "#322C6E",
          800: "#221E49",
          900: "#110F25",
        },
        // Nigerian flag green. The brand stays purple/gold, so green is a
        // national accent — flag marks, "local" and verified signals — never a
        // second primary competing with the CTA colour.
        naija: {
          DEFAULT: "#008753",
          green: "#008753",
          50: "#E6F4ED",
          100: "#C2E5D5",
          200: "#8ACDB0",
          300: "#4FB489",
          400: "#1E9B69",
          500: "#008753",
          600: "#006E44",
          700: "#005534",
          800: "#003D26",
          900: "#002417",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Hairline fintech-style elevation: cards separate from the neutral
        // page background via contrast, not big colored shadows.
        card: "0 1px 2px rgba(17, 15, 37, 0.04), 0 1px 3px rgba(17, 15, 37, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
