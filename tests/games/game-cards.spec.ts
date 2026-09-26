import { expect, test } from '@playwright/test';

async function authenticate(page: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E test credentials are not configured in CI');

  const login = await page.request.post('/api/auth/login', {
    data: { mobile, password },
  });
  expect(login.status()).toBe(200);

  const setCookie = login.headers()['set-cookie'];
  const match = setCookie?.match(/brix_access_token=([^;]+)/);
  expect(match?.[1], 'Login did not return brix_access_token').toBeTruthy();

  await page.context().addCookies([{
    name: 'brix_access_token',
    value: match![1],
    url: process.env.BASE_URL || 'http://127.0.0.1:3000',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
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
