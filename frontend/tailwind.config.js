/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde pasto claro (primária)
        pasto: {
          50: '#f3f9f0', 100: '#e4f2dd', 200: '#cbe6bf', 300: '#a9d497', 400: '#86bf70',
          500: '#68a653', 600: '#518a40', 700: '#426f35', 800: '#37592e', 900: '#2e4a28',
        },
        // Neutros palha/creme
        palha: {
          50: '#fbfaf5', 100: '#f5f2e8', 200: '#ebe5d4', 300: '#dbd1b8', 400: '#bfb294',
          500: '#9c8f72', 600: '#7b7059', 700: '#5e5645', 800: '#463f33', 900: '#2f2a22',
        },
        // Acento terra suave
        terra: { 300: '#e4c9a8', 400: '#d4ad82', 500: '#c0935f', 600: '#9f7546' },
        ceu: { 100: '#e8f4f8', 200: '#cfe7f0' },
      },
      fontFamily: { sans: ['Nunito', 'Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        soft: '0 1px 2px rgba(70,63,51,.06), 0 4px 16px -4px rgba(70,63,51,.10)',
        lift: '0 2px 4px rgba(70,63,51,.06), 0 12px 28px -8px rgba(66,111,53,.25)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        wiggle: { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-10deg)' }, '75%': { transform: 'rotate(10deg)' } },
        graze: { '0%': { transform: 'translateX(0)' }, '50%': { transform: 'translateX(60px)' }, '100%': { transform: 'translateX(0)' } },
        drift: { from: { transform: 'translateX(-15%)' }, to: { transform: 'translateX(115%)' } },
        nod: { '0%,100%': { transform: 'rotate(0)' }, '50%': { transform: 'rotate(14deg)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        sway: { '0%,100%': { transform: 'skewX(0)' }, '50%': { transform: 'skewX(6deg)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s ease-out both',
        wiggle: 'wiggle .5s ease-in-out',
        graze: 'graze 18s ease-in-out infinite',
        drift: 'drift 60s linear infinite',
        nod: 'nod 3s ease-in-out infinite',
        pop: 'pop .35s ease-out both',
        sway: 'sway 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
