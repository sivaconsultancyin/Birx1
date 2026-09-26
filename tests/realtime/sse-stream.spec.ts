import { test, expect } from '@playwright/test';
import * as http from 'node:http';

test('authenticated realtime stream sends a connected event', async ({ request }) => {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E test credentials are not configured');
  expect(mobile, 'E2E_TEST_MOBILE must be configured for authenticated realtime validation').toBeTruthy();
  expect(password, 'E2E_TEST_PASSWORD must be configured for authenticated realtime validation').toBeTruthy();

  const login = await request.post('/api/auth/login', { data: { mobile, password } });
  expect(login.status()).toBe(200);
  const setCookie = login.headers()['set-cookie'];
  expect(setCookie).toContain('brix_access_token=');

  const cookie = setCookie.split(';')[0];
  const responsePromise = new Promise<{ status: number; contentType: string; body: string }>((resolve, reject) => {
    const base = new URL('/api/events/stream', 'http://127.0.0.1:3000');
    const req = http.get(base, {
      headers: { Cookie: cookie, Accept: 'text/event-stream' },
    }, (res: any) => {
      res.setEncoding('utf8');
      let body = '';
      const timer = setTimeout(() => {
        req.destroy();
        resolve({ status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] ?? ''), body });
      }, 2000);
      res.on('data', (chunk: string) => {
        body += chunk;
        if (body.includes('"type":"connected"')) {
          clearTimeout(timer);
          req.destroy();
          resolve({ status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] ?? ''), body });
        }
      });
      res.on('error', reject);
    });
    req.on('error', (err: Error) => {
      if (!/socket hang up|ECONNRESET/.test(err.message)) reject(err);
    });
  });

  const stream = await responsePromise;
  expect(stream.status).toBe(200);
  expect(stream.contentType).toMatch(/text\/event-stream/);
  expect(stream.body).toContain('"type":"connected"');
});
