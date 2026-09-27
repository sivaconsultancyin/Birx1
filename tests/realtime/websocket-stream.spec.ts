import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

async function login(request: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E credentials are not configured');
  const response = await request.post('/api/auth/login', { data: { mobile, password } });
  expect(response.status()).toBe(200);
  const cookie = response.headers()['set-cookie']?.split(';')[0];
  expect(cookie).toContain('brix_access_token=');
  return cookie;
}

test('authenticated WebSocket sends connected event', async ({ request }) => {
  const cookie = await login(request);
  const wsUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/^http/, 'ws') + '/ws';

  const result = await new Promise<{ opened: boolean; connected: boolean }>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
    const timer = setTimeout(() => { ws.close(); resolve({ opened: false, connected: false }); }, 5000);
    ws.on('open', () => undefined);
    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'connected') {
          clearTimeout(timer);
          ws.close();
          resolve({ opened: true, connected: true });
        }
      } catch {}
    });
    ws.on('error', reject);
  });

  expect(result).toEqual({ opened: true, connected: true });
});
