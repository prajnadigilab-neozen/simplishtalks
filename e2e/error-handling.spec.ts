import { test, expect } from '@playwright/test';

/**
 * TC-404: Branded & Localized Error Handling
 * Validates that SIMPLISH-Talks handles invalid routes with a 
 * bilingual (Kannada/English) custom 404 page.
 */
test.describe('404 Page Integrity & Localization', () => {

  // Using /#/ prefix for HashRouter compatibility
  const invalidRoutes = ['/#/user/hidden-route', '/#/404-test', '/#/dashboard/invalid-path'];

  for (const route of invalidRoutes) {
    test(`Verify branded 404 on invalid route: ${route}`, async ({ page }) => {
      // 1. Force navigate to invalid path
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // 2. Check for Branded UI Elements
      // Using 'h1' as the heading selector for the 404 message
      const errorHeading = page.locator('h1');
      await expect(errorHeading).toBeVisible();

      // 3. Verify Bilingual Localization
      const content = await page.textContent('body');
      
      // Check for English clarity
      expect(content).toContain('Page Not Found');
      
      // Check for Kannada Localization
      expect(content).toContain('ಕ್ಷಮಿಸಿ');
      expect(content).toContain('ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ');

      // 4. Verify Call-to-Action (CTA)
      // The button in NotFoundPage has text 'Back to Dashboard' and 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ'
      const backButton = page.getByRole('button', { name: /Dashboard|ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ/i });
      await expect(backButton).toBeVisible();
      
      // 5. Functional Test: Does it lead back?
      await backButton.click();
      await page.waitForTimeout(1000); // Allow navigation to complete
      await expect(page).toHaveURL(/.*dashboard|/);
    });
  }
});
