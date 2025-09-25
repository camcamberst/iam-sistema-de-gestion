/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'aim-bg': 'rgb(var(--aim-bg))',
        'aim-card': 'rgba(var(--aim-card), <alpha-value>)',
        'aim-border': 'rgba(var(--aim-border), <alpha-value>)',
      },
      backdropBlur: {
        'glass': '14px',
      },
    },
  },
  plugins: [],
};