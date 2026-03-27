import { Page } from '@playwright/test';

/**
 * Shared login helper for all test cases.
 * Navigates to /#/login (HashRouter) and authenticates using phone + password.
 */
export async function loginAs(page: Page, phone: string, password: string): Promise<void> {
  await page.goto('/#/login');

  // Ensure the Sign In tab is active (toggle tab switcher)
  const signInTab = page.locator('button', { hasText: 'Sign In' }).first();
  await signInTab.waitFor({ state: 'visible' });
  await signInTab.click();

  // Fill Phone Number
  await page.locator('input[autocomplete="tel"]').fill(phone);

  // Fill Password
  await page.locator('input[autocomplete="current-password"]').fill(password);

  // Submit form
  await page.locator('button[type="submit"]').click();

  // Wait until we're away from the login page (redirect to dashboard/placement)
  await page.waitForFunction(
    () => !window.location.hash.includes('/login') && !window.location.hash.includes('/register'),
    { timeout: 15_000 }
  );
}

/**
 * Wait for the page to fully settle after navigation (SPA lazy-loading).
 */
export async function waitForSPA(page: Page, timeout = 8000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}
