/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050d1a',
        primary: '#3b82f6',
        secondary: '#06b6d4',
        'app-bg': '#070b14',          // deeper black-navy
        'surface-1': '#0f1629',       // card background
        'surface-2': '#161f35',       // elevated card
        'surface-3': '#1e2a42',       // hover state
        'accent-purple': '#6c63ff',   // primary CTA
        'accent-teal': '#00d4b1',     // success/positive
        'accent-amber': '#f5a623',    // warning
        'accent-rose': '#ff6b8a',     // negative/spent
        'text-primary': '#eef2ff',    // main text
        'text-secondary': '#8892b0',  // secondary text
        'text-muted': '#4a5568',      // muted text
        'border-subtle': 'rgba(255,255,255,0.06)',
        'border-medium': 'rgba(255,255,255,0.12)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        slideIn: 'slideIn 0.3s ease',
      },
    },
  },
  plugins: [],
}
