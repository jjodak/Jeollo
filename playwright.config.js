import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'https://127.0.0.1:5183',
    ignoreHTTPSErrors: true,
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
    { name: 'small-mobile', use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5183 --strictPort',
    url: 'https://127.0.0.1:5183',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://jeollo.example.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-public-key-placeholder',
      VITE_NAVER_MAP_NCP_KEY_ID: '',
      VITE_NAVER_MAP_CLIENT_ID: '',
    },
  },
});
