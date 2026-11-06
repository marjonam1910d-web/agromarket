/** AgroMarket dizayn tokenlari — Organic Modern + Premium Marketplace */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1F6B45', 50: '#EEF6F1', 100: '#D5EADD', 200: '#ABD5BB', 300: '#7DBB95', 400: '#4C9A6C', 500: '#1F6B45', 600: '#1A5C3B', 700: '#154B30', 800: '#123B2A', 900: '#0C2A1D' },
        lime: { DEFAULT: '#8BC34A', 50: '#F3F9EC', 100: '#E2F1CF', 400: '#A3D06B', 500: '#8BC34A', 600: '#6FA334' },
        cream: { DEFAULT: '#F7F5EA', 50: '#FCFBF6', 100: '#F7F5EA', 200: '#EEEAD6', 300: '#E3DDC0' },
        sun: { DEFAULT: '#F2C14E', 100: '#FDF3D9', 400: '#F5CE6E', 500: '#F2C14E', 600: '#D9A62F' },
        ink: { DEFAULT: '#18251C', soft: '#2B3A30' },
        muted: '#647067',
        danger: '#DC2626',
        success: '#16A34A',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      spacing: { 4.5: '1.125rem', 13: '3.25rem', 18: '4.5rem' },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        soft: '0 1px 2px rgba(18,59,42,.04), 0 8px 24px -8px rgba(18,59,42,.12)',
        card: '0 1px 2px rgba(18,59,42,.05), 0 12px 32px -12px rgba(18,59,42,.18)',
        glow: '0 0 0 1px rgba(139,195,74,.25), 0 10px 40px -10px rgba(139,195,74,.55)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-14px) rotate(6deg)' } },
        drift: { '0%': { transform: 'translate3d(0,0,0) rotate(0)', opacity: 0 }, '10%': { opacity: 1 }, '100%': { transform: 'translate3d(60px,-110vh,0) rotate(220deg)', opacity: 0 } },
        rise: { '0%': { transform: 'translateY(0) scale(1)', opacity: 0 }, '15%': { opacity: 1 }, '100%': { transform: 'translateY(-260px) scale(.4)', opacity: 0 } },
        grow: { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: .7 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        drift: 'drift 18s linear infinite',
        rise: 'rise 6s ease-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        pulseRing: 'pulseRing 2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
