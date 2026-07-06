import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Bundle the shared package from its TS sources: the CJS dist build
      // hides named exports (enums) from Rollup's static analysis.
      '@tickets/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
