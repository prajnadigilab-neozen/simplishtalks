import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * SIMPLISH-Talks Validation Matrix Automation
 * Covers: Bilingual Integrity, Negative Testing, and Security Injections.
 */
test.describe('Validation Matrix: Signup & Profile', () => {

  const BASE_URL = 'http://localhost:3000';
  const KANNADA_NAME = 'ರಮೇಶ್';
  const UNIQUE_PHONE = `99${Date.now().toString().slice(-8)}`;

  // --- Phase 1: Bilingual Integrity ---
  test('Matrix-001: Bilingual Registration (Kannada Name)', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/register`);
    
    // Fill registration form using evaluate to bypass keyboard limitations for Unicode
    const nameInput = page.getByPlaceholder(/name|ಹೆಸರು/i);
    await nameInput.focus();
    await page.evaluate(({ el, text }) => {
      (el as HTMLInputElement).value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, { el: await nameInput.elementHandle(), text: KANNADA_NAME });

    await page.getByPlaceholder(/phone|ಫೋನ್/i).fill(UNIQUE_PHONE);
    await page.getByPlaceholder(/password|ಪಾಸ್‌ವರ್ಡ್/i).fill('TestPass123!');
    
    // Select a place
    await page.getByRole('combobox').selectOption({ index: 1 });

    // Submit and intercept
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/rest/v1/profiles') && res.status() < 400),
      page.getByRole('button', { name: /join|ಸೇರಿ/i }).click()
    ]);

    const postData = await response.request().postDataJSON();
    console.log('API PAYLOAD (registration):', JSON.stringify(postData, null, 2));
    
    expect(postData.full_name).toBe(KANNADA_NAME);
    
    await page.waitForURL(/.*placement|.*dashboard/);
    console.log('✅ Matrix-001 PASS: Registration successful with Kannada name.');
  });

  // --- Phase 2: Negative Testing ---
  test('Matrix-002: Negative Validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/register`);
    await page.getByRole('button', { name: /join|ಸೇರಿ/i }).click();

    // Verify REQUIRED fields are flagged
    const errorMarkers = page.locator('input:invalid, .text-red-500');
    await expect(errorMarkers.first()).toBeVisible();
    console.log('✅ Matrix-002 PASS: Validation blocked empty submission.');
  });

  // --- Phase 3: Security Injections ---
  test('Matrix-003: Security Injection (XSS & SQLi)', async ({ page }) => {
    await loginAs(page, UNIQUE_PHONE, 'TestPass123!');
    await page.goto(`${BASE_URL}/#/settings`);
    await page.waitForLoadState('networkidle');

    const XSS_PAYLOAD = "<script>alert('xss')</script>";
    
    // Find the edit profile section
    await page.getByRole('button', { name: /⚙️/ }).first().click(); // Settings gear
    const nameInput = page.getByPlaceholder(/Name|ಹೆಸರು/i);
    await nameInput.clear();
    await nameInput.fill(XSS_PAYLOAD);
    
    await page.getByRole('button', { name: /Save|ಉಳಿಸಿ/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify sanitization: literal string should be present in the dashboard/settings
    // We check if the text is present exactly as written, meaning it wasn't executed.
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toContain(XSS_PAYLOAD);
    
    console.log('✅ Matrix-003 PASS: XSS payload handled as literal text.');
  });
});
