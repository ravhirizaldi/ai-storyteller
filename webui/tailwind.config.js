/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f8f7f4',
          100: '#f0ede7',
          200: '#e0d9ce',
          300: '#cbbfb0',
          400: '#b3a090',
          500: '#9c8373',
          600: '#856a5a',
          700: '#6e5548',
          800: '#5b463c',
          900: '#4c3b33',
          950: '#291f1b',
        },
        parchment: {
          50: '#fdfcf8',
          100: '#faf7ef',
          200: '#f4eddb',
          300: '#ebdfc1',
        },
        sage: {
          50: '#f4f7f4',
          100: '#e6ede6',
          200: '#cddcce',
          300: '#a9c2aa',
          400: '#7ea280',
          500: '#5e8460',
          600: '#496849',
          700: '#3c543d',
          800: '#334534',
          900: '#2c3a2d',
        },
      },
    },
  },
  plugins: [],
}
