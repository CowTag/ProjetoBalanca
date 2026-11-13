/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde institucional (primária) — sóbrio, alto contraste
        pasto: {
          50: '#eef6f1', 100: '#d5eadc', 200: '#acd4bb', 300: '#7bb894', 400: '#4b9a6f',
          500: '#2a7d53', 600: '#1f6643', 700: '#195237', 800: '#15412d', 900: '#0f3022',
        },
        // Neutros (cinza grafite)
        palha: {
          50: '#f6f7f9', 100: '#eceff2', 200: '#dfe3e8', 300: '#c6ccd4', 400: '#959eaa', 500: '#677180',
          600: '#4c5563', 700: '#363d48', 800: '#232831', 900: '#14181e',
        },
        // Âmbar (alertas)
        terra: { 300: '#f1dcae', 400: '#dcb15e', 500: '#b8862e', 600: '#8f651c' },
        ceu: { 100: '#e9eff6', 200: '#d6e1ee' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,24,30,.05)',
        lift: '0 4px 16px -4px rgba(20,24,30,.16)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up .18s ease-out both',
      },
    },
  },
  plugins: [],
};
