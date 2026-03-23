/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      colors: {
        // Fresh, airy palette
        primary: "#0EA5E9", // sky blue
        secondary: "#020617", // near-black text
        accent: "#E0F2FE", // soft blue accent
        surface: "#F1F5F9", // light dashboard background
      },
      boxShadow: {
        card:
          "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        "card-md":
          "0 8px 16px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)",
        "card-lg":
          "0 18px 30px rgba(15,23,42,0.08), 0 6px 10px rgba(15,23,42,0.04)",
      },
    },
  },
  plugins: [],
};