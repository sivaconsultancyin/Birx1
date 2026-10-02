import { expect, test } from '@playwright/test';

const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:10000';
const api = (path: string) => `${backendUrl}${path}`;

test('Aviator runs continuous server-authoritative rounds in one permanent room', async ({ request }) => {
  test.setTimeout(110000);
  const first = await request.get(`${process.env.BACKEND_URL || 'http://127.0.0.1:10000'}/api/games/aviator/state`);
  expect(first.status()).toBe(200);
  const firstJson = await first.json();
  expect(firstJson.state).toMatchObject({ roundId: expect.any(String), roomId: 'aviator-main', phase: expect.stringMatching(/betting|running|crashed/) });

  const firstRound = firstJson.state.roundId;
  const firstRoom = 'aviator-main';

  let sawProgress = false;
  let sawNewRound = false;
  // A legitimate round can reach the server-side 50x crash cap before the next round starts.
  // Allow the E2E test to observe the full authoritative lifecycle without false negatives.
  const deadline = Date.now() + 70000;

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const response = await request.get(api('/api/games/aviator/state'));
    expect(response.status()).toBe(200);
    const state = (await response.json()).state;

    expect(state.roundId).toEqual(expect.any(String));
    expect(state.roomId).toBe('aviator-main');
    expect(state.multiplier).toEqual(expect.any(Number));
    expect(state.previousMultipliers).toEqual(expect.any(Array));

    if (state.roundId === firstRound && (state.phase === 'running' || state.phase === 'crashed') && typeof state.multiplier === 'number' && state.multiplier >= 1) {
      sawProgress = true;
    }
    if (state.roundId !== firstRound) {
      sawNewRound = true;
      break;
    }
  }

  expect(sawProgress).toBeTruthy();
  expect(sawNewRound).toBeTruthy();
  expect(firstRoom).toBe('aviator-main');
});
