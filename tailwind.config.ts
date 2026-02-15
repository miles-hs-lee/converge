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
        bg: "#edf7f5",
        panel: "#ffffff",
        text: "#11263f",
        muted: "#4f6477",
        accent: "#0d9488",
        line: "#c9e3de"
      },
      boxShadow: {
        soft: "0 12px 36px rgba(9, 34, 50, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
