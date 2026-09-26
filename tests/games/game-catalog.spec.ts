import { test, expect } from '@playwright/test';

test('game catalog renders the six configured games for an authenticated player', async ({ page }) => {
  await page.goto('/');

  // The app intentionally shows a splash before auth/game screens.
  await page.locator('#auth-screen, #screen-games').first().waitFor({ state: 'visible', timeout: 15000 });

  if (await page.locator('#auth-screen').isVisible()) {
    test.skip(true, 'Authenticated player credentials are not configured in this CI environment');
    return;
  }

  await expect(page.locator('#screen-games')).toBeVisible();
  await expect(page.getByText(/All Games \(6\)/i)).toBeVisible();
  await expect(page.locator('[id^="game-card-"]')).toHaveCount(6);
});
