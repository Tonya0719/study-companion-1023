import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // 把 pdf worker 单独分块，避免主包过大
        manualChunks(id) {
          if (id.includes('pdf.worker')) return 'pdf-worker';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
