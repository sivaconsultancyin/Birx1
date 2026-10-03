import type { RouletteBet, RouletteState } from '../../types.ts';

export type RoulettePhase = 'betting' | 'spinning' | 'result';
export type RouletteRound = {
  id: string;
  phase: RoulettePhase;
  winningNumber: number | null;
  startsAt: string;
  endsAt: string;
};
export type RouletteSettlementResult = {
  totalBet: number;
  grossPayout: number;
  netResult: number;
  isWin: boolean;
};
