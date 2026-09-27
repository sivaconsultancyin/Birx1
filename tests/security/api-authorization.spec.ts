import { expect, test } from '@playwright/test';

test.describe('API authorization boundaries', () => {
  test('rejects unauthenticated wallet mutation', async ({ request }) => {
    const response = await request.post('/api/wallet/withdraw', {
      data: { amount: 500, upiId: 'test@upi', idempotencyKey: 'auth-boundary-' + Date.now() },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('rejects unauthenticated admin mutation', async ({ request }) => {
    const response = await request.post('/api/admin/recharges/test/approve');
    expect([401, 403]).toContain(response.status());
  });

  test('rejects unauthenticated game mutation', async ({ request }) => {
    const response = await request.post('/api/games/aviator/bet', {
      data: { amount: 100 },
    });
    expect([401, 403, 404]).toContain(response.status());
  });

  test('rejects unauthenticated realtime stream', async ({ request }) => {
    const response = await request.get('/api/events/stream', {
      headers: { Accept: 'text/event-stream' },
    });
    expect([401, 403]).toContain(response.status());
  });
});
