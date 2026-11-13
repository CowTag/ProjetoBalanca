import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Desliga o tempo real (Socket.io) em builds na Vercel (VERCEL=1): lá o app faz polling
    'import.meta.env.VITE_REALTIME': JSON.stringify(
      process.env.VITE_REALTIME ?? (process.env.VERCEL ? 'false' : 'true'),
    ),
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
