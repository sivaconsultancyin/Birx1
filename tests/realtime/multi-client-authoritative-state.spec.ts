import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

async function login(request: any) {
  const mobile = process.env.E2E_TEST_MOBILE;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!mobile || !password, 'E2E credentials are not configured');
  let response = await request.post(`${process.env.BACKEND_URL || 'http://127.0.0.1:10000'}/api/auth/login', { data: { mobile, password } });
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    response = await request.post(`${process.env.BACKEND_URL || 'http://127.0.0.1:10000'}/api/auth/login`, { data: { mobile, password } });
  }
  expect(response.status()).toBe(200);
  const cookie = response.headers()['set-cookie']?.split(';')[0];
  expect(cookie).toContain('brix_access_token=');
  return cookie;
}

async function waitForGameState(cookie: string, gameId: string, version: number) {
  const wsUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:10000').replace(/^http/, 'ws') + '/ws';
  return await new Promise<boolean>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
    const timer = setTimeout(() => { ws.close(); resolve(false); }, 8000);
    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'game_state' && data.gameId === gameId && Number(data.version) === version) {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        }
      } catch {}
    });
    ws.on('error', reject);
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

  const streamA = waitForGameState(cookieA, gameId, version);
  const streamB = waitForGameState(cookieB, gameId, version);
  await new Promise(resolve => setTimeout(resolve, 750));

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

  await expect.poll(async () => (await streamA) && (await streamB), { timeout: 9000 }).toBeTruthy();
  await supabase.from('authoritative_game_states').delete().eq('game_id', gameId);
});
