/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eagle: {
          main: 'var(--bg-main)',
          elevated: 'var(--bg-elevated)',
          panel: 'var(--bg-panel)',
          preview: 'var(--bg-preview)',
          border: 'var(--border)',
          accent: 'var(--accent)',
          'btn-bg': 'var(--btn-bg)',
          'btn-hover': 'var(--btn-bg-hover)',
          primary: 'var(--btn-primary)',
          'primary-hover': 'var(--btn-primary-hover)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
        }
      }
    },
  },
  plugins: [],
}