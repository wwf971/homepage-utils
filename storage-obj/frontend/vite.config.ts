import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      '/health': {
        target: 'http://127.0.0.1:5107',
        changeOrigin: true,
      },
      '/echo': {
        target: 'http://127.0.0.1:5107',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../build',
    emptyOutDir: true,
  },
})
