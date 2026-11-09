import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Read API_PORT from .env too, so the proxy always points at the API server.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.API_PORT || env.API_PORT || 8787;
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true, // reachable from a phone on the same network
      proxy: {
        '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.js'],
    },
  };
});
