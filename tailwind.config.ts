import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm hospitality palette
        canvas: "#FAFAF7",
        ink: "#1F2421",
        muted: "#6B7470",
        line: "#E8E4DA",
        accent: {
          DEFAULT: "#2F5D50",
          deep: "#1F4842",
          soft: "#E6EFEB",
        },
        danger: "#B4413B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      borderRadius: {
        card: "12px",
        control: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(31, 36, 33, 0.04), 0 4px 16px rgba(31, 36, 33, 0.04)",
        focus: "0 0 0 3px rgba(47, 93, 80, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
