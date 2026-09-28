import { expect, test } from '@playwright/test';

async function authenticate(page: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E test credentials are not configured in CI');

  await page.goto('/');
  await expect(page.locator('#auth-screen')).toBeVisible({ timeout: 15000 });
  await page.locator('#input-mobile-number').fill(mobile!);
  await page.locator('#input-password').fill(password!);
  await page.locator('#btn-auth-submit').click();
  await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#auth-screen')).toBeHidden({ timeout: 10000 });
}
test('game catalog renders the six configured games for an authenticated player', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 15000 });
  await page.locator('#nav-tab-games').click();
  await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/All Games \(6\)/i)).toBeVisible();
  await expect(page.locator('[id^="game-card-"]')).toHaveCount(6);
});
