import { test, expect } from '@playwright/test';

test('realtime endpoint rejects unauthenticated access', async ({ request }) => {
  const response = await request.get('/api/realtime');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});
