import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'], setupFiles: ['tests/unit/setup.ts'] },
});
