/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#0a0f1a',
          900: '#111827',
          800: '#1f2937',
          accent: '#f59e0b',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
