import type { RouletteBet } from '../../types.ts';
import { ROULETTE_LIMITS } from './constants.ts';

export function validateRouletteBetAmount(amount: number): void {
  if (!Number.isFinite(amount)) throw new Error('Invalid roulette bet amount');
  if (amount < ROULETTE_LIMITS.minimumBet) throw new Error(`Minimum bet is ₹${ROULETTE_LIMITS.minimumBet}`);
  if (amount > ROULETTE_LIMITS.maximumBet) throw new Error(`Maximum bet per spot is ₹${ROULETTE_LIMITS.maximumBet}`);
}

export function validateRouletteBets(bets: RouletteBet[]): number {
  if (!Array.isArray(bets) || bets.length === 0) throw new Error('At least one bet is required');
  let total = 0;
  for (const bet of bets) {
    const amount = Number(bet.amount || 0);
    validateRouletteBetAmount(amount);
    total += amount;
  }
  if (total > ROULETTE_LIMITS.maximumExposure) {
    throw new Error(`Maximum round exposure is ₹${ROULETTE_LIMITS.maximumExposure}`);
  }
  return total;
}

export function attachRouletteUser(bets: RouletteBet[], userId: string, placedAt: string) {
  return bets.map((bet) => ({ ...bet, userId, placedAt }));
}
