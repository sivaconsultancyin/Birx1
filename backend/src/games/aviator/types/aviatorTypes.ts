export interface AviatorBet {
  betId: string;
  amount: number;
  cashedOut: boolean;
  cashOutMultiplier?: number;
  winAmount?: number;
}

export interface AviatorState {
  roomId?: string;
  roundId: string;
  phase: 'betting' | 'running' | 'crashed';
  multiplier: number;
  crashMultiplier: number | null;
  countdown: number;
  previousMultipliers: number[];
}
