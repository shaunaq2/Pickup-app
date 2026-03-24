/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        green: {
          light: "#E1F5EE",
          mid: "#5DCAA5",
          DEFAULT: "#1D9E75",
          dark: "#0F6E56",
          text: "#085041",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "SF Pro Text", "Helvetica Neue", "sans-serif"],
      },
    },
  },
  plugins: [],
};
