/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Category colors
        cardio: {
          DEFAULT: '#0ea5e9', // sky-500
          light: 'rgba(14, 165, 233, 0.2)',
        },
        strength: {
          DEFAULT: '#8b5cf6', // violet-500
          light: 'rgba(139, 92, 246, 0.2)',
        },
        other: {
          DEFAULT: '#10b981', // emerald-500
          light: 'rgba(16, 185, 129, 0.2)',
        },
        // Zone colors
        zone: {
          1: '#60a5fa', // blue-400
          2: '#4ade80', // green-400
          3: '#facc15', // yellow-400
          4: '#fb923c', // orange-400
          5: '#f87171', // red-400
          hit: '#ef4444', // red-500
        },
      },
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
    },
  },
  plugins: [],
}
