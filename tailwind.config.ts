import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import { designColors, extendedGridTemplateColumns, fontFamilySans } from "./lib/design-tokens";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: designColors.ink,
        sand: designColors.sand,
        clay: designColors.clay,
        moss: designColors.moss,
        ember: designColors.ember,
        sky: designColors.sky
      },
      fontFamily: {
        sans: [...fontFamilySans]
      },
      gridTemplateColumns: {
        ...extendedGridTemplateColumns
      },
      boxShadow: {
        card: "0 20px 40px rgba(16, 19, 22, 0.08)"
      }
    }
  },
  plugins: [forms]
};

export default config;
