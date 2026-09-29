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

  test('rejects unauthenticated WebSocket connection', async () => {
    const WebSocket = (await import('ws')).default;
    const wsUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/^http/, 'ws') + '/ws';
    const result = await new Promise<string>((resolve) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => { ws.close(); resolve('timeout'); }, 5000);
      ws.on('open', () => { clearTimeout(timer); ws.close(); resolve('opened'); });
      ws.on('unexpected-response', (_req, res) => { clearTimeout(timer); resolve(String(res.statusCode)); });
      ws.on('error', () => { clearTimeout(timer); resolve('error'); });
    });
    expect(['401', 'error']).toContain(result);
  });

  test('all registered game API routes exist and enforce authentication', async ({ request }) => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/games/roulette/rules'], ['GET', '/api/games/roulette/round'],
      ['GET', '/api/games/roulette/state'], ['GET', '/api/games/roulette/history'],
      ['POST', '/api/games/roulette/bets'], ['GET', '/api/games/roulette/bets'],
      ['GET', '/api/games/roulette/settlement/test-round'], ['POST', '/api/games/roulette/spin'],
      ['GET', '/api/games/teen-patti/state'], ['POST', '/api/games/teen-patti/bet'],
      ['POST', '/api/games/teen-patti/new-round'], ['POST', '/api/games/teen-patti/action'],
      ['GET', '/api/games/aviator/state'], ['POST', '/api/games/aviator/bet'],
      ['POST', '/api/games/aviator/cashout'], ['GET', '/api/games/dice/state'],
      ['POST', '/api/games/dice/roll'], ['GET', '/api/games/dragon-tiger/state'],
      ['POST', '/api/games/dragon-tiger/deal'], ['GET', '/api/games/andar-bahar/state'],
      ['POST', '/api/games/andar-bahar/deal'],
    ];
    for (const [method, url] of routes) {
      const response = method === 'GET' ? await request.get(url) : await request.post(url, { data: {} });
      expect([401, 403]).toContain(response.status(), `${method} ${url} must be registered and protected`);
    }
  });
});
