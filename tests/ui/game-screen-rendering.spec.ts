import { expect, test } from '@playwright/test';

async function authenticate(page: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E test credentials are not configured in CI');

  const login = await page.request.post('/api/auth/login', { data: { mobile, password } });
  expect(login.status()).toBe(200);
  const setCookie = login.headers()['set-cookie'];
  const match = setCookie?.match(/brix_access_token=([^;]+)/);
  expect(match?.[1], 'Login did not return brix_access_token').toBeTruthy();
  await page.context().addCookies([{
    name: 'brix_access_token', value: match![1],
    url: process.env.BASE_URL || 'http://127.0.0.1:3000',
    httpOnly: true, sameSite: 'Lax'
  }]);
}

const games = [
  ['roulette', /roulette/i], ['teen-patti', /teen.?patti/i], ['aviator', /aviator/i],
  ['dice', /dice/i], ['dragon-tiger', /dragon.?tiger/i], ['andar-bahar', /andar.?bahar/i],
] as const;

for (const [id, heading] of games) {
  test(`${id}: user-visible game screen renders without browser errors`, async ({ page }) => {
    await authenticate(page);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 15000 });
    await page.locator('#nav-tab-games').click();
    await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`#btn-play-${id}`)).toBeVisible({ timeout: 10000 });
    await page.locator(`#btn-play-${id}`).click();
    await expect(page.getByText(heading).first()).toBeVisible({ timeout: 10000 });

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Supabase unavailable/i);
    expect(pageErrors, `page errors on ${id}: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `console errors on ${id}: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
}
