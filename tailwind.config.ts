import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crust: "#2a1a12",
        dough: "#f7efe3",
        butter: "#f4c04e",
        caramel: "#c97b3c",
        berry: "#b4455f",
        sage: "#6b8f71",
      },
      fontFamily: {
        display: ["ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
