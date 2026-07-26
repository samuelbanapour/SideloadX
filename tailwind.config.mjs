/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#e8eaf0',
          100: '#c5c9d4',
          200: '#9ea5b8',
          300: '#77819c',
          400: '#596686',
          500: '#3b4c70',
          600: '#354568',
          700: '#2d3c5e',
          800: '#263354',
          900: '#1a2344',
          950: '#0f1628',
        },
        accent: {
          DEFAULT: '#007AFF',
          light: '#4DA3FF',
          dark: '#0056CC',
        },
        success: '#34C759',
        warning: '#FF9500',
        danger: '#FF3B30',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 122, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 122, 255, 0.4)' },
        },
      },
    },
  },
  plugins: [],
}
