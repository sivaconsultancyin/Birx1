import { test, expect } from '@playwright/test';

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
  const stream = await request.get('/api/events/stream', {
    headers: { Cookie: cookie },
    timeout: 10000,
  });
  expect(stream.status()).toBe(200);
  expect(stream.headers()['content-type']).toMatch(/text\/event-stream/);
  const body = await stream.body();
  expect(body.toString()).toContain('"type":"connected"');
});
