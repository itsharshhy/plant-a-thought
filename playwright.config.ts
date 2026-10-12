import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 2,
  retries: 0,
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:4173',
    // In sandboxes with an outbound proxy, route the browser through it (localhost stays direct).
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
  },
  webServer: process.env.E2E_URL ? undefined : [
    { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: false, timeout: 120_000 },
    // Same app built without Supabase, so live rooms use BroadcastChannel between tabs (tests the game protocol offline).
    { command: 'VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir dist-offline && npx vite preview --outDir dist-offline --port 4174 --strictPort', port: 4174, reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'small-phone', use: { viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, browserName: 'chromium' } },
  ],
});
