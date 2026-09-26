import { test, expect } from '@playwright/test';

test.describe('protected game-state boundary', () => {
  test('realtime stream rejects unauthenticated access', async ({ request }) => {
    const response = await request.get('/api/realtime');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('wallet balance rejects unauthenticated access', async ({ request }) => {
    const response = await request.get('/api/wallet/balance');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
