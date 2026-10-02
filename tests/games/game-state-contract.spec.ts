import { test, expect } from '@playwright/test';

test.describe('protected game-state boundary', () => {
  test('WebSocket endpoint rejects unauthenticated access', async () => {
    const WebSocket = (await import('ws')).default;
    const wsUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:10000').replace(/^http/, 'ws') + '/ws';
    const result = await new Promise<string>((resolve) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => { ws.close(); resolve('timeout'); }, 5000);
      ws.on('open', () => { clearTimeout(timer); ws.close(); resolve('opened'); });
      ws.on('unexpected-response', (_req, res) => { clearTimeout(timer); resolve(String(res.statusCode)); });
      ws.on('error', () => { clearTimeout(timer); resolve('error'); });
    });
    expect(['401', 'error']).toContain(result);
  });

  test('wallet balance rejects unauthenticated access', async ({ request }) => {
    const response = await request.get(`${process.env.BACKEND_URL || 'http://127.0.0.1:10000'}/api/wallet/balance');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
