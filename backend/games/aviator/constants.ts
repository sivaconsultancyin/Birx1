import type { AviatorState } from '../../types.ts';

export const AVIATOR_ROOM_ID = 'aviator-main';
export const AVIATOR_MIN_BET = 10;
export const AVIATOR_BETTING_SECONDS = 5;
export const AVIATOR_RESULT_DELAY_MS = 3500;

export const INITIAL_AVIATOR_STATE: AviatorState = {
  roomId: AVIATOR_ROOM_ID,
  roundId: 'AV-initial',
  phase: 'betting',
  multiplier: 1.0,
  crashMultiplier: null,
  countdown: AVIATOR_BETTING_SECONDS,
  previousMultipliers: [2.14, 1.35, 12.8, 1.88, 3.42, 1.05, 5.61]
};
