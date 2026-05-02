import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Two project lanes (mobile, desktop). Global setup pre-creates
 * the canonical test users via the Supabase admin API; global teardown
 * scrubs sessions tagged with `E2E_TEST_PREFIX` so the shared dev DB
 * doesn't accumulate junk.
 *
 * The webServer block boots the dev server when running locally — set
 * `E2E_BASE_URL` to point at an already-running app to skip it. In CI we
 * want a production build (`pnpm build && pnpm start`), so leave that to
 * the workflow itself and rely on `reuseExistingServer: !process.env.CI`.
 */
const baseURL = process.env.E2E_BASE_URL?.trim() || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  globalSetup: require.resolve('./e2e/utils/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/utils/global-teardown.ts'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 13'], baseURL },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL },
    },
  ],
});
