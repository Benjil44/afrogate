import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('gsap')) return 'gsap';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 4200, strictPort: true },
  preview: { host: '127.0.0.1', port: 4200, strictPort: true },
});
