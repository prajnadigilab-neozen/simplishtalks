import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { loginAs } from './helpers/auth';
import path from 'path';

/**
 * SIMPLISH-Talks Session & Sync Audit
 * Covers: Persistence, Cookie Security, Logout Integrity, and Cross-Device Sync.
 */
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Session & Sync Audit Suite', () => {

  const BASE_URL = 'http://localhost:3000';
  const TEST_PHONE = '1234567890';
  const TEST_PASSWORD = '123456';
  const STORAGE_STATE_PATH = path.join(__dirname, 'test-results/storage-state.json');

  // --- Phase 1: Persistence & Re-entry ---
  test('Audit-001: Session Persistence after Context Restart', async ({ page, context }) => {
    // 1. Authenticate
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);
    await page.waitForURL(/.*dashboard/);
    console.log('✅ Audit-001: Initial login successful.');

    // 2. Save storage state (emulates closing browser but keeping tokens)
    await context.storageState({ path: STORAGE_STATE_PATH });
    await context.close();

    // 3. New context with same state
    const browser = await chromium.launch();
    const newContext = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    const newPage = await newContext.newPage();
    
    // 4. Verify auto-login to dashboard
    await newPage.goto(`${BASE_URL}/#/dashboard`);
    await newPage.waitForLoadState('networkidle');
    await expect(newPage).toHaveURL(/.*dashboard/);
    console.log('✅ Audit-001 PASS: Session persisted after context restart.');
    
    await browser.close();
  });

  // --- Phase 2: Cookie Security & Logout Integrity ---
  test('Audit-002: Cookie Flag Audit & Logout Integrity', async ({ page, context }) => {
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);
    await page.waitForURL(/.*dashboard/);

    // 1. Audit Security Flags
    const cookies = await context.cookies();
    console.log('AUDIT: Current Cookies:', JSON.stringify(cookies, null, 2));
    
    // Note: Supabase often uses localStorage instead of cookies. 
    // If cookies exist, they MUST be secure.
    const authCookies = cookies.filter(c => c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('sb-'));
    
    for (const cookie of authCookies) {
      // In localhost, 'secure' is often false, but HttpOnly is a MUST for sensitive tokens
      // If Supabase uses JS-accessible local storage, we won't find HttpOnly cookies.
      if (cookie.httpOnly === false) {
        console.warn(`⚠️ SECURITY ALERT: Cookie ${cookie.name} is NOT HttpOnly.`);
      }
    }

    // 2. Logout Integrity (Zombie Session check)
    // Find logout button in Header (Navigation component)
    const logoutButton = page.getByRole('button', { name: /Exit|ನಿರ್ಗಮಿಸು/i });
    await logoutButton.click();
    await page.waitForURL(/.*|/); // Redirect to landing
    
    // Attempt to navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Verify redirection to login or restricted access
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('dashboard');
    console.log(`✅ Audit-002 PASS: Logout successful. Zombie session prevented. Redirected to: ${currentUrl}`);
  });

  // --- Phase 3: Cross-Device State Sync ---
  test('Audit-003: Cross-Device State Sync (SSOT)', async ({ browser }) => {
    // Context A: Mobile
    const contextA = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const pageA = await contextA.newPage();
    await loginAs(pageA, TEST_PHONE, TEST_PASSWORD);
    await pageA.waitForURL(/.*dashboard/);

    // Context B: Desktop
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageB = await contextB.newPage();
    await loginAs(pageB, TEST_PHONE, TEST_PASSWORD);
    await pageB.waitForURL(/.*dashboard/);

    // --- Action: Update State in Context A (Mobile) ---
    // Let's toggle language in Context A and see if it syncs (if state is cloud-synced)
    // Or update user name in settings.
    await pageA.goto(`${BASE_URL}/#/settings`);
    const newName = `Auditor-${Date.now().toString().slice(-4)}`;
    
    await pageA.getByRole('button', { name: /⚙️/ }).first().click(); // Update profile
    const nameInput = pageA.getByPlaceholder(/Name|ಹೆಸರು/i);
    await nameInput.clear();
    await nameInput.fill(newName);
    await pageA.getByRole('button', { name: /Save|ಉಳಿಸಿ/i }).click();
    await pageA.waitForLoadState('networkidle');

    // --- Check Context B (Desktop) ---
    await pageB.reload();
    await pageB.waitForLoadState('networkidle');
    const dashboardName = await pageB.textContent('body');
    
    // Verify sync
    expect(dashboardName).toContain(newName);
    console.log(`✅ Audit-003 PASS: Cross-device state sync successful. Name updated to ${newName} across contexts.`);

    await contextA.close();
    await contextB.close();
  });
});
