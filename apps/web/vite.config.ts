import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/**
 * `public/Podcast/` holds the real mixes (≈250 MB, git-ignored, deployed separately). Vite copies
 * the whole public dir into dist; drop the media again so the build output / deploy tarball stay small.
 */
function excludeMediaFromDist(): Plugin {
  return {
    name: 'afrows-exclude-media',
    apply: 'build',
    closeBundle() {
      rmSync(fileURLToPath(new URL('./dist/Podcast', import.meta.url)), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), excludeMediaFromDist()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 700,
    // Never inline fonts as data: URIs; the afrows.com CSP has `font-src 'self'` (no data:).
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id) {
          // gsap core + plugins + lenis + our engine share one lazy "fx" chunk (loaded after first paint).
          if (/node_modules\/(gsap|lenis)\//.test(id) || id.includes('/src/motion/engine')) return 'fx';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 4200, strictPort: true },
  preview: { host: '127.0.0.1', port: 4200, strictPort: true },
});
