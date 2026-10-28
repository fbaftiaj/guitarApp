import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const LISTENING = /listening\.spec\.ts/;
const PHONE = {
  browserName: 'chromium',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
} as const;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run against the production build (`vite preview`) so the
 * service worker, manifest and code splitting behave as they do when deployed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // The fake microphone (e2e/support) plays its test tone without a gesture.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: LISTENING,
      use: PHONE,
    },
    {
      name: 'desktop',
      testIgnore: LISTENING,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // Scoring is judged in milliseconds on the real audio clock: these tests run on
      // their own, after the others, so a busy machine does not disturb their timing.
      name: 'listening',
      testMatch: LISTENING,
      dependencies: ['mobile', 'desktop'],
      fullyParallel: false,
      // One worker: listening tests in different files must not overlap either.
      workers: 1,
      use: PHONE,
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
