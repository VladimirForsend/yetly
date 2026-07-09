import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#171A2B",
          900: "#20243A",
          700: "#474B63",
          600: "#5D6279",
          500: "#73788E",
        },
        canvas: "#F6F7FB",
        brand: {
          50: "#F4F3FF",
          100: "#E9E7FF",
          200: "#D6D2FF",
          500: "#6D63E8",
          600: "#5C53D8",
          700: "#4B43BE",
          900: "#2B286F",
        },
        blue: {
          50: "#EFF6FF",
          500: "#2F6FED",
          600: "#245ED4",
        },
        success: {
          50: "#ECFDF5",
          600: "#147D64",
          700: "#0F6A55"
        },
        warning: {
          50: "#FFF8E8",
          600: "#A96200",
          700: "#8C5200"
        },
        danger: {
          50: "#FFF1F2",
          600: "#D33F55",
          700: "#B52D42"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(23, 26, 43, 0.04), 0 8px 28px rgba(23, 26, 43, 0.06)",
        float: "0 18px 60px rgba(23, 26, 43, 0.18)"
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      }
    },
  },
  plugins: [],
} satisfies Config;
