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

test('each game play control navigates to its game screen', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 15000 });
  await page.locator('#nav-tab-games').click();
  await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });

  const games = [
    ['roulette', /roulette/i], ['teen-patti', /teen.?patti/i], ['aviator', /aviator/i],
    ['dice', /dice/i], ['dragon-tiger', /dragon.?tiger/i], ['andar-bahar', /andar.?bahar/i],
  ] as const;

  for (const [id, heading] of games) {
    await page.locator(`#btn-play-${id}`).click();
    await expect(page.getByText(heading).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /back/i }).first().click();
    await expect(page.locator('#screen-games')).toBeVisible();
  }
});
