import crypto from 'node:crypto';
import { deriveRouletteOutcome, createRouletteFairRound } from './fairness.ts';
import { GAME_ROOM_ID, RED_NUMBERS, ROULETTE_PAYOUT_RULES, ROULETTE_LIMITS, EUROPEAN_WHEEL } from './constants.ts';
import { computeRouletteSettlement } from './settlement.ts';
import type { RouletteState } from '../../types.ts';

/**
 * Roulette domain helpers live here; the authoritative cycle is owned by
 * game.ts so there is exactly one round lifecycle implementation.
 *
 * This adapter is intentionally inert for compatibility with existing imports.
 * New code should call the game lifecycle directly rather than starting a
 * second legacy cycle.
 */
export function createRouletteEngine() {
  return { start: () => undefined };
}

export { createRouletteFairRound, deriveRouletteOutcome, computeRouletteSettlement, GAME_ROOM_ID, RED_NUMBERS, ROULETTE_PAYOUT_RULES, ROULETTE_LIMITS, EUROPEAN_WHEEL };
