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
const games = [
  ['roulette', /roulette/i], ['teen-patti', /teen.?patti/i], ['aviator', /aviator/i],
  ['dice', /dice/i], ['dragon-tiger', /dragon.?tiger/i], ['andar-bahar', /andar.?bahar/i],
] as const;
for (const [id, heading] of games) {
  test(`game navigation: ${id}`, async ({ page }) => {
    await authenticate(page);
    await page.goto('/');
    await expect(page.locator('#bottom-navigation')).toBeVisible({ timeout: 15000 });
    await page.locator('#nav-tab-games').click();
    await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });
    await page.locator(`#btn-play-${id}`).click();
    await expect(page.getByText(heading).first()).toBeVisible({ timeout: 10000 });
    await page.locator('[id^="btn-back-"]').first().click();
    await expect(page.locator('#screen-games')).toBeVisible();
  });
}
