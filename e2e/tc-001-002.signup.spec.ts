/**
 * TC-001 | Signup | Happy Path with Kannada Name
 * TC-002 | Signup | Empty Phone Validation
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

// TC-001: Generate a unique phone to avoid duplicate registration errors
const uniquePhone = `80${Date.now().toString().slice(-8)}`;

test.describe('TC-001 & TC-002 — Signup / Registration', () => {

  test('TC-001: Register with Kannada name and valid credentials', async ({ page }) => {
    await page.goto(`${BASE}/#/register`);

    // Click the "Register" tab to ensure we are in registration mode
    const registerTab = page.locator('button', { hasText: 'Register' }).first();
    await registerTab.waitFor({ state: 'visible' });
    await registerTab.click();

    // Fill Full Name with Kannada characters
    await page.locator('input[autocomplete="name"]').fill('ರಮೇಶ್ ಕುಮಾರ್');

    // Fill unique phone number
    await page.locator('input[autocomplete="tel"]').fill(uniquePhone);

    // Fill password
    await page.locator('input[autocomplete="new-password"]').fill('Test@9876');

    // Fill Village/City
    await page.locator('input[autocomplete="address-level2"]').fill('ಮೈಸೂರು');

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Assert: Redirected away from /register (to placement or dashboard)
    await expect(page).not.toHaveURL(/.*\/#\/register/);
    console.log(`✅ TC-001 PASS — Registered user: ${uniquePhone}`);
  });

  test('TC-002: Empty phone field triggers validation error', async ({ page }) => {
    await page.goto(`${BASE}/#/register`);

    // Ensure Register tab is active
    await page.locator('button', { hasText: 'Register' }).first().click();

    // Fill Name and Password, but SKIP phone
    await page.locator('input[autocomplete="name"]').fill('Test User');
    await page.locator('input[autocomplete="new-password"]').fill('Test@9876');
    await page.locator('input[autocomplete="address-level2"]').fill('Bengaluru');

    // Submit with empty phone
    await page.locator('button[type="submit"]').click();

    // Assert: Validation error appears (in English or Kannada)
    // The error text appears as a <p> below the phone input field
    const phoneError = page.locator('p.text-red-500, p.text-red-400').first();
    await expect(phoneError).toBeVisible({ timeout: 5000 });

    const errorText = await phoneError.textContent();
    expect(errorText).toBeTruthy();
    console.log(`✅ TC-002 PASS — Validation fired: "${errorText}"`);

    // Assert: Still on the register page (form was NOT submitted)
    await expect(page).toHaveURL(/.*\/#\/register/);
  });

});
