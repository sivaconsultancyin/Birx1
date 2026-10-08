import type { RouletteState } from '../../types.ts';

export type RoulettePhase = 'betting' | 'spinning' | 'result';

export type RouletteSettlementResult = {
  totalBet: number;
  grossPayout: number;
  netResult: number;
  isWin: boolean;
};
