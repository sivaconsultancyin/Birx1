import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

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

async function waitForGameState(request: any, cookie: string, gameId: string, version: number) {
  const base = new URL('/api/events/stream', process.env.BASE_URL || 'http://127.0.0.1:3000');
  return await new Promise<boolean>((resolve, reject) => {
    const http = require('node:http');
    const req = http.get(base, { headers: { Cookie: cookie, Accept: 'text/event-stream' } }, (res: any) => {
      res.setEncoding('utf8');
      let body = '';
      const timer = setTimeout(() => { req.destroy(); resolve(false); }, 6000);
      res.on('data', (chunk: string) => {
        body += chunk;
        if (body.includes('"type":"game_state"') && body.includes('"gameId":"' + gameId + '"') && body.includes('"version":' + version)) {
          clearTimeout(timer);
          req.destroy();
          resolve(true);
        }
      });
      res.on('error', reject);
    });
    req.on('error', (err: Error) => {
      if (!/socket hang up|ECONNRESET/.test(err.message)) reject(err);
    });
  });
}

test('two authenticated clients receive the same authoritative realtime state', async ({ request }) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !key, 'Supabase service-role credentials are not configured');

  const cookieA = await login(request);
  const cookieB = await login(request);
  const gameId = 'e2e-realtime-' + Date.now();
  const version = 1;
  const supabase = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

  const streamA = waitForGameState(request, cookieA, gameId, version);
  const streamB = waitForGameState(request, cookieB, gameId, version);

  const { error } = await supabase.from('authoritative_game_states').upsert({
    game_id: gameId,
    round_id: 'e2e-round',
    phase: 'running',
    version,
    state: { gameId, roundId: 'e2e-round', phase: 'running', version, marker: 'e2e' },
    updated_at: new Date().toISOString(),
  });
  expect(error, error?.message).toBeNull();

  await expect.poll(async () => {
    const { data } = await supabase.from('authoritative_game_states').select('version').eq('game_id', gameId).single();
    return Number(data?.version || 0);
  }, { timeout: 5000 }).toBe(version);

  await expect.poll(async () => (await streamA) && (await streamB), { timeout: 8000 }).toBeTruthy();

  await supabase.from('authoritative_game_states').delete().eq('game_id', gameId);
});
