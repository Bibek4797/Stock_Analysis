/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#08090c',
        surface: '#0d1015',
        'surface-2': '#12161d',
        'surface-3': '#191e27',
        line: '#1a1f28',
        'line-2': '#252b36',
        fg: '#e6e9ee',
        'fg-2': '#a3abb8',
        'fg-3': '#697282',
        'fg-4': '#454c58',
        accent: '#4d8dff',
        up: '#2ebd85',
        down: '#f0555a',
        warn: '#d9a548',
        terminal: {
          bg: "#0B0E14",
          card: "#10141D",
          panel: "#0E121A",
          border: "#1E2430",
          hover: "#151B26",
          active: "#1A2230",
          subtext: "#64748B",
          text: "#E2E8F0",
          accent: "#38BDF8",
          bull: "#10B981",
          bear: "#F43F5E",
          warning: "#F59E0B"
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        indeterminate: 'indeterminate 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'fade-in': 'fade-in 220ms ease-out both',
      },
      keyframes: {
        indeterminate: {
          '0%': { transform: 'translateX(-100%) scaleX(0.4)' },
          '100%': { transform: 'translateX(250%) scaleX(0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
