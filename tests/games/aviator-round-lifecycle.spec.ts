import { expect, test } from '@playwright/test';

test('Aviator runs continuous server-authoritative rounds in one permanent room', async ({ request }) => {
  const first = await request.get('/api/games/aviator/state');
  expect(first.status()).toBe(200);
  const firstJson = await first.json();
  expect(firstJson.state).toMatchObject({ roundId: expect.any(String), phase: expect.stringMatching(/betting|running|crashed/) });

  const firstRound = firstJson.state.roundId;
  const firstRoom = 'aviator-main';

  let sawProgress = false;
  let sawNewRound = false;
  const deadline = Date.now() + 12000;

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const response = await request.get('/api/games/aviator/state');
    expect(response.status()).toBe(200);
    const state = (await response.json()).state;

    expect(state.roundId).toEqual(expect.any(String));
    expect(state.multiplier).toEqual(expect.any(Number));
    expect(state.previousMultipliers).toEqual(expect.any(Array));

    if (state.roundId === firstRound && (state.phase === 'running' || state.phase === 'crashed') && state.multiplier >= 1) {
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
