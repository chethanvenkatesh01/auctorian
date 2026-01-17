/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class', // 👈 Enables the toggle mechanism
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'], // For Data Precision
        display: ['Inter Tight', 'system-ui', 'sans-serif'], // For Headlines/Logos
      },
      colors: {
        // 🔮 Semantic Colors (The Magic Switch)
        void: {
          DEFAULT: 'rgb(var(--void-bg) / <alpha-value>)', // Main Background
          deep: 'rgb(var(--void-bg) / <alpha-value>)',
          surface: 'rgb(var(--void-surface) / <alpha-value>)', // Cards/Modals
        },
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        
        // 🎨 Glass System
        glass: {
          border: 'rgba(var(--glass-border), var(--glass-border-opacity))',
          surface: 'rgba(var(--glass-surface), var(--glass-surface-opacity))',
        },

        // ⚡ Intelligence Accents
        ai: {
          DEFAULT: 'rgb(var(--ai-glow) / <alpha-value>)',
          glow: '#818cf8',
          dim: 'rgba(99, 102, 241, 0.1)',
        },
        
        // Semantic Alerts (Consistent)
        success: '#10b981', // Emerald
        warning: '#f59e0b', // Amber
        error: '#ef4444',   // Red
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(var(--ai-glow), 0.15)',
        'glow-md': '0 0 20px rgba(var(--ai-glow), 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-void': 'linear-gradient(to bottom right, var(--void-surface), var(--void-bg))',
      }
    },
  },
  plugins: [],
}