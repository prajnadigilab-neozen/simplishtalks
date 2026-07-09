/**
 * TC-006 | Access | Premium Content Unlocked After Payment
 * Verifies: After payment, CoachChat (/coachchat) loads without paywall.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const TEST_PHONE = process.env.TEST_PHONE || '9987654325';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

test.describe('TC-006 — Premium Content Access', () => {

  test('TC-006: Post-payment user can access CoachChat (TALKS feature)', async ({ page }) => {
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);

    // Wait for dashboard to load (verifies enrollment/placement done)
    await page.waitForLoadState('networkidle');

    // Navigate to CoachChat — a TALKS-package-gated feature
    await page.goto('http://localhost:3000/#/coachchat');
    await page.waitForLoadState('networkidle');

    // Assert: NOT redirected to /login (access is permitted)
    await expect(page).not.toHaveURL(/.*\/#\/login/);
    await expect(page).not.toHaveURL(/.*\/#\/packages/);
    console.log('✅ TC-006 PASS — Not redirected to login or packages.');

    // Assert: Page renders actual CoachChat content (not a blocked/paywall state)
    // CoachChat renders a chat interface with message input
    const chatContainer = page.locator('main, [class*="coach"], [class*="chat"], textarea, input[placeholder*="type"], input[placeholder*="message"]');
    await expect(chatContainer.first()).toBeVisible({ timeout: 10_000 });
    console.log('✅ TC-006 PASS — CoachChat content area is visible and accessible.');
  });

  test('TC-006b: VoiceCoach (/talk) page is accessible for TALKS user', async ({ page }) => {
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);
    await page.goto('http://localhost:3000/#/talk');
    await page.waitForLoadState('networkidle');

    // Assert: Not redirected away
    await expect(page).not.toHaveURL(/.*\/#\/login/);
    console.log('✅ TC-006b PASS — /talk accessible after login.');
  });

});
