/**
 * TC-009 | Logout | Secure Session Termination
 * Verifies: Post-logout, navigating to /dashboard redirects to /login.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const TEST_PHONE = process.env.TEST_PHONE || '9987654325';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

test.describe('TC-009 — Secure Logout', () => {

  test('TC-009: After logout, protected routes redirect to /login', async ({ page }) => {
    // Step 1: Log in
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);

    // Step 2: Verify we are authenticated (on a protected page)
    await page.goto('http://localhost:3000/#/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/.*\/#\/login/);
    console.log('✅ TC-009 STEP 1 — Authenticated, on Dashboard.');

    // Step 3: Click the "Exit" / Logout button
    const exitBtn = page.locator('button', { hasText: /Exit|Sign Out|Logout/i });
    await exitBtn.first().waitFor({ state: 'visible', timeout: 8000 });
    await exitBtn.first().click();

    // Wait for sign-out to complete (redirected to /)
    await page.waitForURL(/.*\/#\/?$|.*\/$/,  { timeout: 10_000 });
    console.log('✅ TC-009 STEP 2 — Logout clicked, redirected to landing page.');

    // Step 4: Verify localStorage auth is cleared
    const authCleared = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.every(k => !k.includes('auth-token'));
    });
    expect(authCleared).toBe(true);
    console.log('✅ TC-009 STEP 3 — localStorage auth token cleared.');

    // Step 5: Force navigate to protected /dashboard
    await page.goto('http://localhost:3000/#/dashboard');
    await page.waitForLoadState('networkidle');

    // Assert: Redirected to /login (or /register) — access is denied
    const finalUrl = page.url();
    const isBlocked = finalUrl.includes('/login') || finalUrl.includes('/register') || finalUrl.endsWith('#/');
    expect(isBlocked).toBe(true);
    console.log(`✅ TC-009 PASS — Protected route blocked post-logout. Redirected to: ${finalUrl}`);
  });

});
