import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

async function login(request: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E credentials are not configured');
  let response = await request.post('/api/auth/login', { data: { mobile, password } });
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    response = await request.post('/api/auth/login', { data: { mobile, password } });
  }
  expect(response.status()).toBe(200);
  const cookie = response.headers()['set-cookie']?.split(';')[0];
  expect(cookie).toContain('brix_access_token=');
  return cookie;
}

async function collectState(cookie: string, gameId: string, durationMs: number) {
  const wsUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/^http/, 'ws') + '/ws';
  return await new Promise<any[]>((resolve, reject) => {
    const events: any[] = [];
    const timer = setTimeout(() => { ws.close(); resolve(events); }, durationMs);
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'game_state' && data.gameId === gameId) events.push(data);
      } catch {}
    });
    ws.on('error', error => { clearTimeout(timer); reject(error); });
  });
}

test('two authenticated clients receive the same PostgreSQL authoritative realtime state', async ({ request }) => {
  const cookieA = await login(request);
  const cookieB = await login(request);
  const [eventsA, eventsB] = await Promise.all([
    collectState(cookieA, 'aviator', 15000),
    collectState(cookieB, 'aviator', 15000),
  ]);
  expect(eventsA.length).toBeGreaterThan(0);
  expect(eventsB.length).toBeGreaterThan(0);
  const roundsA = new Set(eventsA.map(e => e.roundId ?? e.state?.roundId).filter(Boolean));
  const roundsB = new Set(eventsB.map(e => e.roundId ?? e.state?.roundId).filter(Boolean));
  expect([...roundsA].some(roundId => roundsB.has(roundId))).toBeTruthy();
});
