import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { chunkSizeWarningLimit: 1600 },
  // pdf.js worker 以 ES module 打包（Safari 15+ 支持 module worker）
  worker: { format: 'es' },
});
