import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
      },
      colors: {
        orange: {
          DEFAULT: "#F27717",
          50: "#FFF7EE",
          100: "#FFE8D3",
          200: "#FED6AF",
          300: "#FDBE83",
          400: "#F79C4F",
          500: "#F48224",
          600: "#F27717",
          700: "#D9650E",
          800: "#B4540C",
          900: "#8F450D",
        },
        "orange-dark": "#D9650E",
        "orange-light": "#FFF6EE",
        "orange-mid": "#FBB97C",
        blue: "#5BB8D4",
        "blue-dark": "#3A9AB8",
        "blue-light": "#EFF9FC",
        dark: "#111827",
        "dark-2": "#1F2937",
        "dark-3": "#374151",
        brand: {
          blue: "#338CB2",
          sky: "#62AAC9",
          orange: "#F27717",
          ink: "#1F1D16",
          neutral: "#475569",
          cream: "#F4E8CC",
          forest: "#3D5950",
          bgLight: "#F5FAFC",
        },
      },
      boxShadow: {
        floating: "0 20px 45px -12px rgba(51, 140, 178, 0.16)",
        card: "0 10px 30px -5px rgba(31, 29, 22, 0.06)",
        "glow-orange": "0 10px 25px -4px rgba(242, 119, 23, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
