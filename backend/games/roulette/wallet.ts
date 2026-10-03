export type RouletteWalletOperation = 'debit' | 'credit' | 'refund';
export function rouletteSettlementKey(roundId: string, userId: string): string {
  return `roulette:settlement:${roundId}:${userId}`;
}
export function rouletteBetIdempotencyKey(userId: string, key: string): string {
  return `roulette:bet:${userId}:${key}`;
}
