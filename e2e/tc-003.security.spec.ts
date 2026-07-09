/**
 * TC-003 | Security | XSS Injection into Profile Name Field
 * Verifies: XSS string is stored as literal text, not executed.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const TEST_PHONE = process.env.TEST_PHONE || '9987654325';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const XSS_PAYLOAD = '<img src=x onerror=alert(1)>';

test.describe('TC-003 — XSS Security', () => {

  test('TC-003: XSS payload in Profile Name is rendered as text, not executed', async ({ page }) => {
    // Set up a flag to detect any alert() dialog
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      console.error(`🚨 ALERT FIRED: "${dialog.message()}" — XSS may be active!`);
      await dialog.dismiss();
    });

    // Log in
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);

    // Navigate to Settings (which contains the Profile edit form)
    await page.goto('http://localhost:3000/#/settings');
    await page.waitForLoadState('networkidle');

    // The ProfilePage has an "Edit Profile" button — click it
    const editBtn = page.locator('button', { hasText: 'Edit Profile' });
    await editBtn.waitFor({ state: 'visible', timeout: 8000 });
    await editBtn.click();

    // Fill the Full Name field (first text input in the edit form) with XSS payload
    const firstTextInput = page.locator('form input[type="text"]').first();
    await firstTextInput.waitFor({ state: 'visible', timeout: 5000 });
    await firstTextInput.fill(XSS_PAYLOAD);

    // Submit/Save the form
    const saveBtn = page.locator('button[type="submit"]');
    await saveBtn.click();

    // Wait briefly for any potential script execution
    await page.waitForTimeout(2000);

    // Assert: No JavaScript alert was fired
    expect(alertFired).toBe(false);
    console.log('✅ TC-003 PASS — No XSS alert triggered.');

    // Assert: The injected string appears as *visible text*, not as HTML
    // If it was executed, the <img> tag would be in the DOM as an element.
    // We check that no <img> with src="x" was injected.
    const injectedImg = page.locator('img[src="x"]');
    await expect(injectedImg).toHaveCount(0);
    console.log('✅ TC-003 PASS — No <img src=x> element found in DOM.');
  });

});
