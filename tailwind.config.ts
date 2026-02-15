import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#edf4fb",
        panel: "#ffffff",
        text: "#0f1d33",
        muted: "#5a6d84",
        accent: "#0891b2",
        line: "#d3e4f3"
      },
      boxShadow: {
        soft: "0 12px 36px rgba(14, 38, 64, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
