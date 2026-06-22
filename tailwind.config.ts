import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
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
        naija: {
          green: "#008753",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px -8px rgba(83, 74, 183, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
