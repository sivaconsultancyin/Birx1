import type { AviatorBet } from '../../types.ts';

export function calculateAviatorPayout(bet: AviatorBet, multiplier: number): number {
  return Math.floor(bet.amount * multiplier);
}

export function createAviatorLossOutcome(crashMultiplier: number) {
  return `Flew away @ ${crashMultiplier}x`;
}

export function createAviatorWinOutcome(multiplier: number) {
  return `Cashed out @ ${multiplier}x`;
}
