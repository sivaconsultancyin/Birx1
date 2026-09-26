import { test, expect } from '@playwright/test';

test('login screen renders and validates empty/invalid input', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#input-mobile-number')).toBeVisible();
  await expect(page.locator('#input-password')).toBeVisible();
  await expect(page.locator('#btn-auth-submit')).toBeVisible();
  await page.locator('#btn-auth-submit').click();
  await expect(page.getByText(/valid 10-digit mobile number/i)).toBeVisible();
});
