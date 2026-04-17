/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        // Surface hierarchy
        'bg-base': 'var(--surface)',
        surface: 'var(--surface-container)',
        'surface-low': 'var(--surface-container-low)',
        'surface-high': 'var(--surface-container-high)',
        'surface-highest': 'var(--surface-container-highest)',
        'surface-bright': 'var(--surface-bright)',

        // Text
        'text-main': 'var(--on-surface)',
        'text-muted': 'var(--on-surface-variant)',
        'text-dim': 'var(--on-surface-dim)',

        // Accent
        accent: 'var(--primary)',
        'accent-container': 'var(--primary-container)',
        'accent-dim': 'var(--primary-dim)',
        'accent-amber': 'var(--tertiary)',

        // Secondary (AI/Teal)
        teal: 'var(--secondary)',
        'teal-container': 'var(--secondary-container)',
        'teal-dim': 'var(--secondary-dim)',

        // Legacy compat
        border: 'var(--outline)',
        'bg-highlight': 'var(--surface-container-low)',

        // Error
        error: 'var(--error)',
      },
      borderRadius: {
        organic: '1.25rem',
        md: '0.75rem',
      },
      boxShadow: {
        ambient: 'var(--shadow-ambient)',
        float: 'var(--shadow-float)',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
