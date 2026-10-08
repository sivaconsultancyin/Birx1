import type { TeenPattiHandRank } from '../../../../src/types.ts';

export const TEEN_PATTI_PAYOUT_MULTIPLIERS: Record<TeenPattiHandRank, number> = {
  'Trail / Trio': 5,
  'Pure Sequence': 4,
  'Sequence': 3,
  'Color / Flush': 2,
  'Pair': 1,
  'High Card': 1,
};
