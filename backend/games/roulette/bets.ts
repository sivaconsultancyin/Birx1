import type { RouletteBet } from '../../types.ts';
import { ROULETTE_LIMITS } from './constants.ts';

export function validateRouletteBetAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < ROULETTE_LIMITS.minimumBet || amount > ROULETTE_LIMITS.maximumBet) {
    throw new Error('Invalid roulette bet amount');
  }
}

export function validateRouletteBets(bets: RouletteBet[]): void {
  if (!Array.isArray(bets) || bets.length === 0) throw new Error('At least one roulette bet is required');
  for (const bet of bets) validateRouletteBetAmount(Number(bet.amount));
}
