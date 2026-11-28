/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sentra: {
          bg: '#0B1220',
          secondary: '#101B2B',
          card: '#141F30',
          elevated: '#19283B',
          border: '#26364A',
          cyan: '#38BDF8',
          indigo: '#6366F1',
          red: '#EF4444',
          amber: '#F59E0B',
          green: '#22C55E',
          text: '#F8FAFC',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'sentra-glow': '0 0 24px -6px rgba(56, 189, 248, 0.18)',
        'sentra-danger': '0 0 24px -6px rgba(239, 68, 68, 0.28)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
