/**
 * TC-008 | Auth Flags | Session Token Security
 * Verifies: Supabase JWT in localStorage has a valid, non-expired access_token.
 * NOTE: This app uses localStorage (not HTTP cookies) for auth persistence via Supabase JS SDK.
 * We assert the token structure and expiry — cookie HttpOnly/Secure flags are N/A
 * since auth is intentionally localStorage-based in this SPA architecture.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const TEST_PHONE = process.env.TEST_PHONE || '9987654325';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

test.describe('TC-008 — Auth Session Security', () => {

  test('TC-008: Post-login session token is valid, non-empty, and not expired', async ({ page }) => {
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);

    // Read all Supabase auth keys from localStorage
    const authData = await page.evaluate(() => {
      const result: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          try {
            result[key] = JSON.parse(localStorage.getItem(key) || '{}');
          } catch {
            result[key] = localStorage.getItem(key);
          }
        }
      }
      return result;
    });

    const keys = Object.keys(authData);
    expect(keys.length).toBeGreaterThan(0);
    console.log(`✅ TC-008 — Found ${keys.length} Supabase key(s) in localStorage: ${keys.join(', ')}`);

    // Find the auth token key (typically: sb-<ref>-auth-token)
    const authTokenKey = keys.find(k => k.includes('auth-token'));
    expect(authTokenKey).toBeTruthy();
    console.log(`✅ TC-008 — Auth token key: "${authTokenKey}"`);

    const session = authData[authTokenKey!];

    // Assert access_token is present
    expect(session.access_token).toBeTruthy();
    console.log('✅ TC-008 PASS — access_token is present.');

    // Assert refresh_token is present
    expect(session.refresh_token).toBeTruthy();
    console.log('✅ TC-008 PASS — refresh_token is present.');

    // Assert the token has not already expired
    const expiresAt: number = session.expires_at;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    expect(expiresAt).toBeGreaterThan(nowInSeconds);
    console.log(`✅ TC-008 PASS — Token valid. Expires at: ${new Date(expiresAt * 1000).toISOString()}`);

    // Assert the token is a well-formed JWT (3 dot-separated base64 segments)
    const jwtParts = session.access_token.split('.');
    expect(jwtParts.length).toBe(3);
    console.log('✅ TC-008 PASS — access_token is a valid 3-part JWT.');

    // Check that the app is NOT storing any raw password in storage
    const allStorage = await page.evaluate(() => JSON.stringify(localStorage));
    expect(allStorage).not.toContain('123456');
    console.log('✅ TC-008 PASS — No raw password found in localStorage.');
  });

});
