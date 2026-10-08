export function rouletteBetIdempotencyKey(userId: string, key: string): string {
  return `roulette:bet:${userId}:${key}`;
}
