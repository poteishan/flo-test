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
        cream: {
          DEFAULT: '#F9F8F5',
          50: '#FFFFFF',
          100: '#FDFDFC',
          200: '#F9F8F5',
          300: '#F2EFE9',
          400: '#E8E4DA',
          500: '#DCD6C7',
        },
        lime: {
          DEFAULT: '#EBF755',
          light: '#F2FA84',
          hover: '#E2EF43',
          dark: '#CFDC2A',
        },
        forest: {
          DEFAULT: '#0D2319',
          light: '#163527',
          card: '#132E22',
          dark: '#07150E',
          border: '#1E4333',
        },
        pastelBlue: {
          DEFAULT: '#D4E4FC',
          hover: '#C2DBFB',
          light: '#E6F0FE',
          dark: '#A6C8F8',
        },
        charcoal: {
          DEFAULT: '#121417',
          light: '#2B2F36',
          muted: '#5A606A',
        },
        brand: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        dark: {
          bg: '#090d16',
          panel: '#0f172a',
          card: '#131d35',
          border: '#1e293b',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        hand: ['"Caveat"', 'cursive'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'clean': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'clean-lg': '0 12px 30px -4px rgba(0, 0, 0, 0.08)',
        'solid-xs': '2px 2px 0px 0px #121417',
        'solid': '3px 3px 0px 0px #121417',
        'solid-md': '4px 4px 0px 0px #121417',
        'solid-lg': '5px 5px 0px 0px #121417',
        'solid-lime': '4px 4px 0px 0px #0D2319',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
