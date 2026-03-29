import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'app'),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      onLog(level: string, log: any, handler: (level: string, log: any) => void) {
        if (log.code === 'MODULE_LEVEL_DIRECTIVE') return;
        handler(level, log);
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
