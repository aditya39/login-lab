/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// .env lives at the monorepo root.
const ENV_DIR = '../../';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, '');
  return {
    plugins: [react()],
    envDir: ENV_DIR,
    server: {
      // Same-origin proxy so the httpOnly session cookie works without CORS.
      proxy: {
        '/api': env.API_PROXY_TARGET || 'http://localhost:3000',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
    },
  };
});
