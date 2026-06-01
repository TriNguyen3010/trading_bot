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
        // BE "Gamma Trade Platform" (FastAPI). Confirmed by BE team 2026-05-29:
        // tradingbot.ne.com = UI (NOT the server, was 502/down); the real BE
        // is this HTTPS staging host (public → also reachable from home).
        target: 'https://ai-gamma-trade-stg.coin98.dev',
        changeOrigin: true,
        secure: true,
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
