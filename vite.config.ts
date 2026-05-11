/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        // BE FastAPI ("Gamma Trade Platform") nằm ở port 8088 HTTP.
        // Port 8502 là Streamlit dashboard, không phải BE. Confirmed 2026-05-11.
        target: 'http://tradingbot.ne.com:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    watch: {
      usePolling: true,
    },
  },
  // @ts-expect-error - Vitest types conflict with Vite 6
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Exclude parallel-agent worktrees (own node_modules + duplicate tests
    // pollute the run). Keep the defaults too.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/.claude/**',
    ],
  },
});
