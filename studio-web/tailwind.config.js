/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0a0d12',
          surface: '#111620',
          panel: '#161c28',
          border: '#21293a',
          hover: '#293347',
          accent: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};
