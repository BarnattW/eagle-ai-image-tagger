import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Explicit entry so Vite doesn't rely on finding <script type="module"> in index.html
      input: { bundle: resolve(__dirname, 'src/main.jsx') },
      output: {
        entryFileNames: '[name].js',       // → dist/bundle.js
        chunkFileNames: 'chunk-[name].js',
        assetFileNames: (info) => info.name?.endsWith('.css') ? 'bundle.css' : '[name][extname]',
        format: 'es',
      },
    },
  },
})