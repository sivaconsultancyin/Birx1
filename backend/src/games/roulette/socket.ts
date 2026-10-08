export const ROULETTE_SOCKET_EVENTS = {
  roundStarted: 'roulette_round_started',
  bettingOpen: 'roulette_betting_open',
  spinStarted: 'roulette_spin_started',
  result: 'roulette_result',
  playerResult: 'roulette_player_result',
  settlement: 'roulette_settlement',
  walletUpdated: 'roulette_wallet_updated',
} as const;

export type RouletteSocketEvent = typeof ROULETTE_SOCKET_EVENTS[keyof typeof ROULETTE_SOCKET_EVENTS];

export function emitRouletteEvent(
  broadcastRealtime: (event: RouletteSocketEvent, payload: unknown) => unknown,
  event: RouletteSocketEvent,
  payload: unknown,
) {
  return broadcastRealtime(event, payload);
}
