/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        paper: '#F9F9F6',
        sand: '#F1EEE7',
        rule: '#DFDBD1',
        muted: '#77736B',
        clay: '#9A5B3C',
        bronze: { DEFAULT: '#8B7355', 300: '#C4A87F' },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        ui: ['Inter', 'ui-sans-serif', 'system-ui', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      spacing: { 13: '3.25rem' },
      transitionDuration: { 400: '400ms', 600: '600ms', 800: '800ms' },
      transitionTimingFunction: { editorial: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
