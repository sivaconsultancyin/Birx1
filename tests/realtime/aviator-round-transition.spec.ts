import { expect, test } from '@playwright/test';
import * as http from 'node:http';

async function streamEvents(request: any, cookie: string, durationMs: number) {
  const base = new URL('/api/events/stream', process.env.BASE_URL || 'http://127.0.0.1:3000');
  return new Promise<string>((resolve, reject) => {
    const req = http.get(base, { headers: { Cookie: cookie, Accept: 'text/event-stream' } }, (res: any) => {
      res.setEncoding('utf8');
      let body = '';
      const timer = setTimeout(() => { req.destroy(); resolve(body); }, durationMs);
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('error', reject);
    });
    req.on('error', (err: Error) => {
      if (!/socket hang up|ECONNRESET/.test(err.message)) reject(err);
    });
  });
}

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

test('two clients observe Aviator round transition events for the permanent room', async ({ request }) => {
  const cookieA = await login(request);
  const cookieB = await login(request);
  expect(cookieA).toContain('brix_access_token=');
  expect(cookieB).toContain('brix_access_token=');

  const [eventsA, eventsB] = await Promise.all([
    streamEvents(request, cookieA, 20000),
    streamEvents(request, cookieB, 20000),
  ]);

  for (const events of [eventsA, eventsB]) {
    expect(events).toContain('"type":"connected"');
    expect(events).toContain('"gameId":"aviator"');
    expect(events).toContain('"roomId":"aviator-main"');
  }

  const roundsA = [...eventsA.matchAll(/"type":"round_started"[^\n]*?"roundId":"([^"]+)"/g)].map(m => m[1]);
  const roundsB = [...eventsB.matchAll(/"type":"round_started"[^\n]*?"roundId":"([^"]+)"/g)].map(m => m[1]);

  expect(roundsA.length).toBeGreaterThan(0);
  expect(roundsB.length).toBeGreaterThan(0);
  expect(roundsA.some(id => roundsB.includes(id))).toBeTruthy();
});
