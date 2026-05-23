import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Playfair Display", "serif"],
        sans: ["Poppins", "sans-serif"],
      },
      colors: {
        orange: "#F97316",
        "orange-dark": "#EA6B0A",
        "orange-light": "#FFF7ED",
        "orange-mid": "#FDBA74",
        blue: "#5BB8D4",
        "blue-dark": "#3A9AB8",
        "blue-light": "#EFF9FC",
        dark: "#111827",
        "dark-2": "#1F2937",
        "dark-3": "#374151",
      },
    },
  },
  plugins: [],
};

export default config;
