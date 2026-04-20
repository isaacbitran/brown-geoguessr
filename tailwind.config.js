/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5F1E8',
        ink: '#1F1B16',
        brick: '#8B1A1A',
        warmgray: '#6B6358',
        gold: '#B8892E',
        rule: '#D9D1BE',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
