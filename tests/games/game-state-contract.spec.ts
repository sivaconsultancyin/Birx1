import { test, expect } from '@playwright/test';

test.describe('game state API contracts', () => {
  for (const game of ['roulette','teen-patti','aviator','dice','dragon-tiger','andar-bahar']) {
    test(`${game} state endpoint requires authentication`, async ({ request }) => {
      const response = await request.get(`/api/games/${game}/state`);
      expect([401, 403]).toContain(response.status());
    });
  }
});
