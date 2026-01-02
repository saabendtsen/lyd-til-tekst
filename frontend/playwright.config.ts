import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for lyd-til-tekst E2E tests.
 *
 * Run with:
 *   npm run test:e2e          # Run all tests
 *   npm run test:e2e:ui       # Run with UI mode
 *   npm run test:e2e:headed   # Run with visible browser
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL - use local dev server or production
    // IMPORTANT: Must end with trailing slash for relative paths to work correctly
    baseURL: (process.env.TEST_BASE_URL || 'http://localhost:4321/lyd-til-tekst').replace(/\/?$/, '/'),

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - handles authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Main test project - depends on setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use stored auth state
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Run local dev server before starting the tests (optional)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:4321',
  //   reuseExistingServer: !process.env.CI,
  // },
});
