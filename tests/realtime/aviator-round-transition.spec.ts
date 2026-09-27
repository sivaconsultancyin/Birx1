import { expect, test } from '@playwright/test';
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
  return response.headers()['set-cookie']?.split(';')[0];
}

async function collectAviatorEvents(cookie: string, durationMs: number) {
  const wsUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/^http/, 'ws') + '/ws';

  return await new Promise<any[]>((resolve, reject) => {
    const events: any[] = [];
    let collectionTimer: ReturnType<typeof setTimeout> | null = null;
    const handshakeTimer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket authentication/handshake timed out'));
    }, 10000);

    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookie } });

    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'connected' && !collectionTimer) {
          clearTimeout(handshakeTimer);
          collectionTimer = setTimeout(() => {
            ws.close();
            resolve(events);
          }, durationMs);
        }
        if (data.gameId === 'aviator' || (data.type === 'game_state' && data.gameId === 'aviator')) {
          events.push(data);
        }
      } catch {}
    });

    ws.on('error', error => {
      clearTimeout(handshakeTimer);
      if (collectionTimer) clearTimeout(collectionTimer);
      reject(error);
    });
  });
}

test('two clients observe Aviator round transitions for the permanent room', async ({ request }) => {
  const cookieA = await login(request);
  const cookieB = await login(request);

  const [eventsA, eventsB] = await Promise.all([
    collectAviatorEvents(cookieA, 20000),
    collectAviatorEvents(cookieB, 20000),
  ]);

  for (const events of [eventsA, eventsB]) {
    expect(events.some(e => e.type === 'connected')).toBeTruthy();
  }

  const roundsA = eventsA.filter(e => e.type === 'game_state' && e.gameId === 'aviator' && (e.roomId === 'aviator-main' || e.state?.roomId === 'aviator-main')).map(e => e.roundId ?? e.state?.roundId).filter(Boolean);
  const roundsB = eventsB.filter(e => e.type === 'game_state' && e.gameId === 'aviator' && (e.roomId === 'aviator-main' || e.state?.roomId === 'aviator-main')).map(e => e.roundId ?? e.state?.roundId).filter(Boolean);
  expect(roundsA.length).toBeGreaterThan(0);
  expect(roundsB.length).toBeGreaterThan(0);
  expect(roundsA.some(id => roundsB.includes(id))).toBeTruthy();
});
