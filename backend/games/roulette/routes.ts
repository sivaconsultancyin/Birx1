export const ROULETTE_API_PREFIX = '/api/games/roulette';
export const ROULETTE_ROUTES = {
  rules: '/rules',
  round: '/round',
  state: '/state',
  bets: '/bets',
  spin: '/spin',
  history: '/history',
  fairness: '/fairness/:roundId',
  settlement: '/settlement/:roundId',
  mySettlement: '/my-settlement/:roundId',
} as const;
