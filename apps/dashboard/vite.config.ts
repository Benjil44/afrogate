import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // VITE_API_PROXY_TARGET (from .env.local or shell) points the local UI at a
  // remote backend (e.g. the VPS). Pair with VITE_API_BASE_URL=/api.
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET;
  return {
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'charts';
          }

          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4000,
    strictPort: true,
    // Dev proxy: set VITE_API_PROXY_TARGET to point the local UI at a remote
    // backend (e.g. the VPS). Use VITE_API_BASE_URL=/api so calls go through here.
    // secure:false ignores the VPS self-signed cert; same-origin → no CORS.
    proxy: proxyTarget
      ? {
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
        }
      : undefined,
  },
  preview: {
    host: '127.0.0.1',
    port: 4000,
    strictPort: true,
  },
  };
});
