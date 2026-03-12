/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#D4AF37",
          600: "#B8962D",
          700: "#92702D",
          800: "#78592B",
          900: "#5E4322"
        }
      },
      boxShadow: {
        gold: "0 10px 30px rgba(212,175,55,0.25)"
      }
    }
  },
  plugins: []
};