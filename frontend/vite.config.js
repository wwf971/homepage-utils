import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  resolve: {
    conditions: ['development', 'module', 'import']
  },
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['@stomp/stompjs', 'sockjs-client']
  }
});

