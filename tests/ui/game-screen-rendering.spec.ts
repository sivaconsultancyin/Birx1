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

const games = [
  ['roulette', /roulette/i], ['teen-patti', /teen.?patti/i], ['aviator', /aviator/i],
  ['dice', /dice/i], ['dragon-tiger', /dragon.?tiger/i], ['andar-bahar', /andar.?bahar/i],
] as const;

test('all user-visible game screens render without browser errors', async ({ page }) => {
  await authenticate(page);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.locator('#nav-tab-games').click();
  await expect(page.locator('#screen-games')).toBeVisible({ timeout: 15000 });

  for (const [id, heading] of games) {
    await test.step(id, async () => {
      await expect(page.locator(`#btn-play-${id}`)).toBeVisible({ timeout: 10000 });
      await page.locator(`#btn-play-${id}`).click();
      await expect(page.getByText(heading).first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('body')).not.toContainText(/Supabase unavailable/i);
      await page.locator('#nav-tab-games').click();
      await expect(page.locator('#screen-games')).toBeVisible({ timeout: 10000 });
    });
  }

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
