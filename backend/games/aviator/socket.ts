export const AVIATOR_SOCKET_EVENTS = {
  roundStarted: 'round_started',
  bettingClosed: 'betting_closed',
  tick: 'aviator_tick',
  result: 'result'
} as const;

export function emitAviatorEvent(
  broadcastRealtime: (event: string, payload: unknown) => void,
  event: string,
  payload: unknown
) {
  broadcastRealtime(event, payload);
}
