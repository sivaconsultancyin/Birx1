/* Shared API route contract. Keep this list synchronized with backend game routes. */
export const gameApiBoundary = {
  aviator: {
    state: '/api/games/aviator/state',
    bet: '/api/games/aviator/bet',
    cashout: '/api/games/aviator/cashout',
  },
  roulette: {
    rules: '/api/games/roulette/rules',
    round: '/api/games/roulette/round',
    state: '/api/games/roulette/state',
    history: '/api/games/roulette/history',
    bets: '/api/games/roulette/bets',
    settlement: (roundId: string) => `/api/games/roulette/settlement/${roundId}`,
    spin: '/api/games/roulette/spin',
  },
  'teen-patti': {
    state: '/api/games/teen-patti/state',
    bet: '/api/games/teen-patti/bet',
    newRound: '/api/games/teen-patti/new-round',
    action: '/api/games/teen-patti/action',
  },
  dice: {
    state: '/api/games/dice/state',
    roll: '/api/games/dice/roll',
  },
  'dragon-tiger': {
    state: '/api/games/dragon-tiger/state',
    deal: '/api/games/dragon-tiger/deal',
  },
  'andar-bahar': {
    state: '/api/games/andar-bahar/state',
    deal: '/api/games/andar-bahar/deal',
  },
} as const;

export type GameId = keyof typeof gameApiBoundary;

// Shared non-game API roots are exposed through frontend/api/client.ts.
// This file is the game-route contract only; it must not invent routes that
// are not implemented by backend/server.ts and the registered game modules.
