import type { Config } from "tailwindcss";

// Every colour is a role from replica/design/tokens.json, exposed as a CSS variable
// in src/app/globals.css. Components never use raw hex.
const role = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: role("bg"),
        surface: role("surface"),
        border: role("border"),
        "border-input": role("border-input"),
        text: role("text"),
        muted: role("text-muted"),
        accent: role("accent"),
        "accent-hover": role("accent-hover"),
        "on-accent": role("on-accent"),
        danger: role("danger"),
        success: role("success"),
        owed: role("owed"),
        owe: role("owe"),
      },
      borderRadius: { sm: "6px", md: "10px", lg: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(22,20,31,.06), 0 1px 3px rgba(22,20,31,.10)",
        pop: "0 12px 32px rgba(22,20,31,.16)",
      },
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
