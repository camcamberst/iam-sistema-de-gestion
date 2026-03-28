/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        aim: {
          blue: 'var(--aim-blue)',
          indigo: 'var(--aim-indigo)',
          surface: 'var(--aim-surface)',
          'surface-header': 'var(--aim-surface-header)',
          border: 'var(--aim-border)',
        },
      },
      borderRadius: {
        'aim': '0.75rem',     /* 12px — estándar del sistema */
        'aim-lg': '1rem',     /* 16px — cards principales */
      },
      boxShadow: {
        'aim-card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'aim-header': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'aim-glow-model': '0 10px 15px -3px var(--aim-glow-model)',
        'aim-glow-admin': '0 10px 15px -3px var(--aim-glow-admin)',
        'aim-glow-superadmin': '0 10px 15px -3px var(--aim-glow-superadmin)',
      },
      animation: {
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.2s ease-out',
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
        },
        fadeIn: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(4px)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      }
    },
  },
  plugins: [],
}