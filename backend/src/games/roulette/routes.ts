export const ROULETTE_API_PREFIX = '/api/games/roulette';
export const ROULETTE_ROUTES = {
  rules: '/rules',
  round: '/round',
  state: '/state',
  bets: '/bets',
  history: '/history',
  fairness: '/fairness/:roundId',
  settlement: '/settlement/:roundId',
} as const;
