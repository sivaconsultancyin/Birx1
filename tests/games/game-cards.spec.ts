import { test, expect } from '@playwright/test';

test('game cards expose working play controls', async ({ page }) => {
  await page.goto('/');
  await page.locator('#auth-screen, #screen-games').first().waitFor({ state: 'visible', timeout: 15000 });
  if (await page.locator('#auth-screen').isVisible()) { test.skip(true, 'Authenticated player credentials are not configured in CI'); return; }
  for (const id of ['roulette','teen-patti','aviator','dice','dragon-tiger','andar-bahar']) {
    await expect(page.locator(`#game-card-${id}`)).toBeVisible();
    await expect(page.locator(`#btn-play-${id}`)).toBeEnabled();
  }
});
