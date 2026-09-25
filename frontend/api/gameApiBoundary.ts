/* Shared transport boundary. Game-specific clients should be added under frontend/games/<game>/api. */
export const gameApiBoundary = {
  aviator: { state: '/api/games/aviator/state', bet: '/api/games/aviator/bet', cashout: '/api/games/aviator/cashout' },
  roulette: { state: '/api/games/roulette/state', bet: '/api/games/roulette/bet' },
  'teen-patti': { state: '/api/games/teen-patti/state', bet: '/api/games/teen-patti/bet' },
  dice: { state: '/api/games/dice/state', bet: '/api/games/dice/bet' },
  'dragon-tiger': { state: '/api/games/dragon-tiger/state', bet: '/api/games/dragon-tiger/bet' },
  'andar-bahar': { state: '/api/games/andar-bahar/state', bet: '/api/games/andar-bahar/bet' },
} as const;

export type GameId = keyof typeof gameApiBoundary;

// Existing shared API implementation remains below during the migration.
