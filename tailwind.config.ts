import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101316",
        sand: "#f4efe8",
        clay: "#d3b28d",
        moss: "#5f6d53",
        ember: "#b94d2f",
        sky: "#d9e8ee"
      },
      fontFamily: {
        sans: ["'Noto Sans JP'", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 20px 40px rgba(16, 19, 22, 0.08)"
      }
    }
  },
  plugins: [forms]
};

export default config;
