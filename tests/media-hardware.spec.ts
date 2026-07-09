import { test, expect, devices } from '@playwright/test';

test.describe('SIMPLISH - Talks: Microphone Hardware Integration', () => {

  test.beforeEach(async ({ page }) => {
    // Mock session to bypass login wall
    await page.addInitScript(() => {
      const mockSession = {
        user: { id: 'test-user-id', user_metadata: { full_name: 'Audit User', package_type: 'SNEHI' } },
        access_token: 'fake-token',
        refresh_token: 'fake-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      const sessionKey = 'sb-ffompmvolxnlqqqnhwhd-auth-token'; 
      localStorage.setItem(sessionKey, JSON.stringify(mockSession));
      localStorage.setItem('dataSaverMode', 'false');
      
      console.log("DEBUG: Mock session injected into localStorage");
    });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  });

  // Test for Android/Chrome Environment
  test('Microphone Access - Granted (Mobile Chrome)', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Pixel 7'],
      permissions: ['microphone'], 
    });
    const page = await context.newPage();

    await page.goto('http://localhost:3000/#/talk');
    await page.waitForLoadState('networkidle');

    try {
      // Trigger Microphone Request
      const micButton = page.locator('button:has-text("Start Practice")');
      await expect(micButton).toBeVisible({ timeout: 10000 });
      await micButton.click();

      // Verify hardware activation (Waveform indicator)
      const voiceIndicator = page.locator('.voice-active-wave'); 
      await expect(voiceIndicator).toBeVisible({ timeout: 10000 });
    } catch (e) {
      await page.screenshot({ path: `failure-grant-${Date.now()}.png` });
      throw e;
    }
    
    await context.close();
  });

  // Test for Permission Denial & Recovery
  test('Microphone Access - Denied & Localized Recovery', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Pixel 7'],
      permissions: [], 
    });
    const page = await context.newPage();

    await page.goto('http://localhost:3000/#/talk');
    await page.waitForLoadState('networkidle');
    
    try {
      // Trigger and Deny
      const micButton = page.locator('button:has-text("Start Practice")');
      await expect(micButton).toBeVisible({ timeout: 10000 });
      await micButton.click();

      // Verify Localized Error Messaging for SIMPLISH users
      const errorMessage = page.locator('div.animate-in.fade-in.slide-in-from-top-4');
      await expect(errorMessage).toContainText(['Microphone access required', 'ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶವನ್ನು ಅನುಮತಿಸಿ'], { timeout: 10000 });
    } catch (e) {
      await page.screenshot({ path: `failure-deny-${Date.now()}.png` });
      throw e;
    }
    
    await context.close();
  });
});
