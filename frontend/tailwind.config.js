/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebedff',
          200: '#dde0ff',
          300: '#c5caff',
          400: '#a3a9ff',
          500: '#7a80ff',
          600: '#6366f1', // Indigos
          700: '#4f46e5',
          800: '#3f38b1',
          900: '#2d287a',
        }
      }
    },
  },
  plugins: [],
}
