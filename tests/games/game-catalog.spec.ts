import { test, expect } from '@playwright/test';

test('game catalog renders the six configured games', async ({ page }) => {
  await page.goto('/');
  const auth = page.locator('#auth-screen');
  if (await auth.count()) test.skip(true, 'Authentication is required before the game catalog in this environment');
  await expect(page.locator('#screen-games')).toBeVisible();
  await expect(page.getByText(/All Games \(6\)/i)).toBeVisible();
  await expect(page.locator('[id^="game-card-"]')).toHaveCount(6);
});
