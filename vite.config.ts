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
        // BE "Gamma Trade Platform" (FastAPI). Updated 2026-06-05 (Tuấn):
        // the real, working BE (creates bots in DB + has backtest data) is
        // tradingbot.ne.com:8088 again — the ai-gamma staging host was stale
        // (bots never landed in the real DB). HTTP host → secure:false; dev
        // proxies over it so no mixed-content here (prod is the open issue).
        target: 'http://tradingbot.ne.com:8088',
        changeOrigin: true,
        secure: false,
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
