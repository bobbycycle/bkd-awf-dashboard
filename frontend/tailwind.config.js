/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          tertiary: '#1c2230',
          card: '#1a2030',
        },
        border: {
          DEFAULT: '#2a3348',
          subtle: '#21293a',
        },
        accent: {
          blue: '#388bfd',
          'blue-hover': '#1f6feb',
        },
        status: {
          allow: '#3fb950',
          block: '#f85149',
          challenge: '#a371f7',
          rate: '#d29922',
        },
        risk: {
          low: '#8b949e',
          med: '#d29922',
          high: '#f0883e',
          critical: '#f85149',
        },
        tier: {
          critical: '#f85149',
          high: '#f0883e',
          medium: '#d29922',
          low: '#3fb950',
          catchall: '#8b949e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
