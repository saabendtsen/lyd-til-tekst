import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/.auth/user.json';

/**
 * Authentication setup - runs before all tests.
 *
 * Uses test credentials from environment variables:
 *   TEST_USER - username (default: testuser)
 *   TEST_PASS - password (default: testpass123)
 *
 * Create test user in database first:
 *   cd backend && source venv/bin/activate
 *   python scripts/create_test_user.py
 */
setup('authenticate', async ({ page }) => {
  const username = process.env.TEST_USER || 'testuser';
  const password = process.env.TEST_PASS || 'testpass123';

  // Go to login page (use ./ for relative to baseURL)
  await page.goto('./');

  // Wait for login form to be visible - use exact selector for username input
  await expect(page.locator('#username')).toBeVisible({
    timeout: 10000
  });

  // Fill login form
  await page.fill('#username', username);
  await page.fill('#password', password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for successful login - should redirect to /app
  // Look for header with username or main app content
  await expect(page.locator('text=Lyd til Tekst').first()).toBeVisible({
    timeout: 10000
  });

  // Wait a bit for the app to fully load
  await page.waitForTimeout(500);

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
