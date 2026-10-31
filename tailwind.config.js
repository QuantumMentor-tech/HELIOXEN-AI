/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        'hx-space': '#070a10',
        'hx-panel': '#0d121d',
        'hx-card': '#131b2a',
        'hx-cyan': '#00f0ff',
        'hx-sky': '#38bdf8',
        'hx-blue': '#0055ff'
      }
    }
  },
  plugins: []
}
