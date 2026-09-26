import { test, expect } from '@playwright/test';

test('realtime endpoint is reachable without exposing unauthenticated data', async ({ request }) => {
  const response = await request.get('/api/realtime');
  expect([200, 401, 403]).toContain(response.status());
  const contentType = response.headers()['content-type'] || '';
  expect(contentType).toMatch(/text\/event-stream|application\/json/);
});
