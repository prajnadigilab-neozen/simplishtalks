import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const TEST_PHONE = process.env.TEST_PHONE || '9987654325';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

test.describe('Refund Rules & Wallet Flow', () => {

  test('Wallet Topup, Navbar Update, and Refund Rules Validation', async ({ page }) => {
    // 1. Log in as standard student user (who has package_type = TALKS, so topup is visible)
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);
    await page.waitForURL(/.*dashboard/);

    // 2. Verify Wallet Pill displays correctly in header (should show wallet icon/pill)
    const walletPill = page.locator('div').filter({ hasText: /👛/ }).first();
    await expect(walletPill).toBeVisible({ timeout: 8000 });
    const initialWalletText = await walletPill.textContent();
    console.log(`Initial Navbar Wallet display: ${initialWalletText}`);

    // 3. Go to packages page to perform a top-up
    await page.goto('http://localhost:3000/#/packages');
    await page.waitForLoadState('networkidle');

    // 4. Verify top-up option is visible (activate TALKS package if not already active)
    const topupHeading = page.locator('h4', { hasText: /SIMPLISH TALKS - Topup|SIMPLISH SNEHI - Topup|ಟಾಪ್-ಅಪ್/i }).first();
    if (await topupHeading.count() === 0) {
      console.log('Package not active. Simulating mock payment first to activate TALKS...');
      await page.goto('http://localhost:3000/#/payment?package=TALKS');
      await page.waitForLoadState('networkidle');
      const payNowBtn = page.locator('button', { hasText: /Pay Now/i });
      await payNowBtn.waitFor({ state: 'visible', timeout: 5000 });
      await payNowBtn.click();
      await page.waitForURL(/.*\/#\/dashboard/, { timeout: 10_000 });

      // Go back to packages page
      await page.goto('http://localhost:3000/#/packages');
      await page.waitForLoadState('networkidle');
      await expect(topupHeading).toBeVisible({ timeout: 5000 });
    } else {
      await expect(topupHeading).toBeVisible({ timeout: 5000 });
    }

    // 5. Intercept the process_user_topup RPC call and click Extend Access
    const topupPromise = page.waitForResponse(
      resp => resp.url().includes('/rpc/process_user_topup') && resp.status() < 400,
      { timeout: 15000 }
    );

    const buyBtn = page.locator('button', { hasText: /Extend Access|ವಿಸ್ತರಿಸಿ/i });
    await buyBtn.click();

    // Wait for the RPC topup response
    await topupPromise;
    console.log('✅ Top-up RPC process_user_topup completed.');

    // 6. Verify top-up transaction appears in history and has "Request Refund"
    const txHistoryHeading = page.locator('h3', { hasText: /Transaction History|ವಹಿವಾಟು ಇತಿಹಾಸ/i });
    await expect(txHistoryHeading).toBeVisible({ timeout: 5000 });

    const topupRow = page.locator('[data-testid="transaction-row"]').filter({ hasText: /Wallet Topup|ವಾಲೆಟ್ ಟಾಪ್-ಅಪ್/i }).first();
    await expect(topupRow).toBeVisible();

    // Verify membership transactions show "Non-Refundable"
    const membershipRow = page.locator('[data-testid="transaction-row"]').filter({ hasText: /Membership:|ಚಂದಾದಾರಿಕೆ:/i }).first();
    if (await membershipRow.count() > 0) {
      await expect(membershipRow.locator('span', { hasText: /Non-Refundable|ಮರುಪಾವತಿ ಮಾಡಲಾಗುವುದಿಲ್ಲ/i })).toBeVisible();
      await expect(membershipRow.locator('button', { hasText: /Request Refund|ಮರುಪಾವತಿ ಕೇಳಿ/i })).toBeHidden();
      console.log('✅ Verified membership is Non-Refundable.');
    }

    // 7. Click "Request Refund" on the top-up transaction
    const refundBtn = topupRow.locator('button', { hasText: /Request Refund|ಮರುಪಾವತಿ ಕೇಳಿ/i }).first();
    await expect(refundBtn).toBeVisible();
    await refundBtn.click();

    // 8. Refund Modal validation (reason dropdown + notes validation)
    const modalHeading = page.locator('h3', { hasText: /Request Wallet Refund|ಮರುಪಾವತಿ ವಿನಂತಿ/i });
    await expect(modalHeading).toBeVisible();

    // Select "Other"
    const reasonSelect = page.locator('select');
    await reasonSelect.selectOption('Other');

    // Notes field is required and must be >= 10 chars
    const notesTextarea = page.locator('textarea');
    await expect(notesTextarea).toBeVisible();
    await notesTextarea.fill('Too short');

    // Confirm Refund button should be disabled due to short notes validation
    const confirmBtn = page.locator('button', { hasText: /Confirm Refund|ಮರುಪಾವತಿ ಖಚಿತಪಡಿಸಿ/i });
    await expect(confirmBtn).toBeDisabled();

    // Fill valid notes (>= 10 chars)
    await notesTextarea.fill('This is a valid refund request explanation.');
    await expect(confirmBtn).toBeEnabled();

    // Intercept process_user_refund RPC
    const refundPromise = page.waitForResponse(
      resp => resp.url().includes('/rpc/process_user_refund') && resp.status() < 400,
      { timeout: 15000 }
    );

    await confirmBtn.click();
    await refundPromise;
    console.log('✅ Refund RPC process_user_refund completed successfully.');

    // 9. Verify UI updates: row shows "Refunded"
    await expect(topupRow.locator('span', { hasText: /Refunded|ಮರುಪಾವತಿ ಮಾಡಲಾಗಿದೆ/i })).toBeVisible({ timeout: 8000 });
    console.log('✅ Verified UI updated to Refunded.');
  });
});
