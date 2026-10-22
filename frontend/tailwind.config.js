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
        brand: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          teal: '#14B8A6',
          tealDark: '#0F766E',
          tealLight: '#CCFBF1',
          sky: '#38BDF8',
          skyDark: '#0284C7',
          skyLight: '#E0F2FE',
          slate: '#1E293B',
          slateDark: '#0F172A',
          slateMuted: '#64748B',
          slateBorder: '#E2E8F0',
        },
        navy: {
          950: '#070C18',
          900: '#0B1120',
          850: '#0F172A',
          800: '#151F38',
          700: '#1E293B',
          600: '#334155',
        },
        cyan: {
          400: '#38BDF8',
          500: '#06B6D4',
          600: '#0891B2',
        },
        teal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
        }
      },
      boxShadow: {
        'soft-sm': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        'soft-md': '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        'soft-lg': '0 10px 30px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
        'soft-teal': '0 10px 25px -5px rgba(20, 184, 166, 0.25)',
      }
    },
  },
  plugins: [],
}
