/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Lora', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'bg-base': 'var(--bg-color)',
        surface: 'var(--surface-color)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        accent: 'var(--accent-color)',
        'accent-amber': 'var(--accent-amber)',
        border: 'var(--border-color)',
        'bg-highlight': 'var(--highlight-color)',
      },
      borderRadius: {
        organic: '1.5rem',
      },
    },
  },
  plugins: [],
};
