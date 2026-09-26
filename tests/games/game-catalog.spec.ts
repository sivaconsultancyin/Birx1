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

test('game catalog renders the six configured games for an authenticated player', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/All Games \(6\)/i)).toBeVisible();
  await expect(page.locator('[id^="game-card-"]')).toHaveCount(6);
});
