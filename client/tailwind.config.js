/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          indigo: '#2C3E8F',
          'indigo-dark': '#1e2d6b',
          teal: '#2BB7A8',
          'teal-dark': '#1e9d90',
          coral: '#FF6B57',
          cloud: '#F6F8FB',
          slate: '#3A3F45',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
