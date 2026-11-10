/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bbfc',
          400: '#8197f8',
          500: '#6272f1',
          600: '#4f56e5',
          700: '#4144ca',
          800: '#3637a3',
          900: '#313481',
          950: '#1e1f4b',
        },
        // Surface colors (dark mode default)
        surface: {
          0:   '#0a0a14',
          50:  '#0f0f1e',
          100: '#141428',
          150: '#17172f',
          200: '#1a1a35',
          250: '#1e1e3c',
          300: '#222244',
          400: '#2d2d5a',
          500: '#3a3a72',
        },
        // Accent
        accent: {
          purple: '#8b5cf6',
          blue:   '#3b82f6',
          cyan:   '#06b6d4',
          green:  '#10b981',
          yellow: '#f59e0b',
          red:    '#ef4444',
          pink:   '#ec4899',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-down':  'slideDown 0.3s ease-out',
        'fade-in':     'fadeIn 0.2s ease-out',
        'scale-in':    'scaleIn 0.2s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        }
      },
      screens: {
        'xs': '375px',
      },
      scale: {
        '98': '0.98',
      },
    },
  },
  plugins: [],
}
