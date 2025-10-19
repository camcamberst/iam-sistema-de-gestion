/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      animation: {
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
      },
      keyframes: {
        heartbeat: {
          '0%': { 
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)'
          },
          '14%': { 
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)'
          },
          '28%': { 
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)'
          },
          '42%': { 
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)'
          },
          '70%': { 
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)'
          },
          '100%': { 
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)'
          }
        }
      }
    },
  },
  plugins: [],
}