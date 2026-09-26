import { test, expect } from '@playwright/test';

test('each game play control navigates to its game screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#auth-screen, #screen-games').first().waitFor({ state: 'visible', timeout: 15000 });
  if (await page.locator('#auth-screen').isVisible()) { test.skip(true, 'Authenticated player credentials are not configured in CI'); return; }

  const games = [
    ['roulette', /roulette/i],
    ['teen-patti', /teen.?patti/i],
    ['aviator', /aviator/i],
    ['dice', /dice/i],
    ['dragon-tiger', /dragon.?tiger/i],
    ['andar-bahar', /andar.?bahar/i],
  ] as const;

  for (const [id, heading] of games) {
    await page.locator(`#btn-play-${id}`).click();
    await expect(page.getByText(heading).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /back/i }).first().click();
    await expect(page.locator('#screen-games')).toBeVisible();
  }
});
