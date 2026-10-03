
import type { RouletteBet, RouletteState } from '../../types.ts';

export const GAME_ROOM_ID = 'roulette-main';
export const EUROPEAN_WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
export const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export const BLACK_NUMBERS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
export const ROULETTE_LIMITS = { minimumBet:10, maximumBet:50000, maximumExposure:500000 };
export const DEFAULT_ROULETTE_CLIENT_SEED = 'roulette-client-v1';
export type ServerRouletteBet = RouletteBet & { userId:string; placedAt:string };
export const ROULETTE_PAYOUT_RULES = ROULETTE_PAYOUT_RULES = {
  straight: { ratio: '35:1', multiplier: 36, description: 'Straight Up: Single number 0-36 (35:1 profit, 36x gross)' },
  split: { ratio: '17:1', multiplier: 18, description: 'Split: Two adjacent numbers (17:1 profit, 18x gross)' },
  street: { ratio: '11:1', multiplier: 12, description: 'Street: Three numbers in a row (11:1 profit, 12x gross)' },
  corner: { ratio: '8:1', multiplier: 9, description: 'Corner: Four adjacent numbers (8:1 profit, 9x gross)' },
  sixline: { ratio: '5:1', multiplier: 6, description: 'Six Line: Six numbers across two rows (5:1 profit, 6x gross)' },
  dozen: { ratio: '2:1', multiplier: 3, description: 'Dozen: 1-12, 13-24, or 25-36 (2:1 profit, 3x gross)' },
  column: { ratio: '2:1', multiplier: 3, description: 'Column: 1st, 2nd, or 3rd column of 12 (2:1 profit, 3x gross)' },
  red_black: { ratio: '1:1', multiplier: 2, description: 'Red / Black: Even money (1:1 profit, 2x gross, 0 loses)' },
  even_odd: { ratio: '1:1', multiplier: 2, description: 'Even / Odd: Even money (1:1 profit, 2x gross, 0 loses)' },
  low_high: { ratio: '1:1', multiplier: 2, description: 'Low / High: 1-18 or 19-36 (1:1 profit, 2x gross, 0 loses)' }
};
