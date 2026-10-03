import crypto from 'node:crypto';
import { deriveRouletteOutcome, createRouletteFairRound } from './fairness.ts';
import { GAME_ROOM_ID, RED_NUMBERS, ROULETTE_PAYOUT_RULES, ROULETTE_LIMITS, EUROPEAN_WHEEL } from './constants.ts';
import { computeRouletteSettlement } from './settlement.ts';
import type { RouletteState } from '../../types.ts';

/**
 * Creates the authoritative 100ms roulette cycle.
 * The host supplies persistence, wallet, realtime and history adapters so
 * roulette-specific timing remains isolated from the application shell.
 */
export function createRouletteEngine(deps: any) {
  return { start: () => deps.startLegacyRouletteCycle?.() };
}

export { createRouletteFairRound, deriveRouletteOutcome, computeRouletteSettlement, GAME_ROOM_ID, RED_NUMBERS, ROULETTE_PAYOUT_RULES, ROULETTE_LIMITS, EUROPEAN_WHEEL };
