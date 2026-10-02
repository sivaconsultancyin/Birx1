import { expect, test } from '@playwright/test';

async function authenticate(page: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E test credentials are not configured in CI');

  await page.goto('/');
  await expect(page.locator('#auth-screen')).toBeVisible({ timeout: 15000 });
  await page.locator('#input-mobile-number').fill(mobile!);
  await page.locator('#input-password').fill(password!);
  const loginResponse = await Promise.all([
    page.waitForResponse(response => /\/api\/auth\/login$/.test(new URL(response.url()).pathname), { timeout: 20000 }),
    page.locator('#btn-auth-submit').click(),
  ]).then(([response]) => response);
  if (!loginResponse.ok()) throw new Error(`Login failed: HTTP ${loginResponse.status()} ${await loginResponse.text()}`);
  await expect(page.locator('#auth-screen')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 20000 });
}
test('game cards expose working play controls', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  await page.waitForTimeout(1000);
  await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 15000 });
  await page.locator('#nav-tab-games').click();
  await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });
  for (const id of ['roulette','teen-patti','aviator','dice','dragon-tiger','andar-bahar']) {
    await expect(page.locator(`#game-card-${id}`)).toBeVisible();
    await expect(page.locator(`#btn-play-${id}`)).toBeEnabled();
  }
});
