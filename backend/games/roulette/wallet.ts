export type RouletteWalletOperation = 'debit' | 'credit' | 'refund';

export function rouletteSettlementKey(roundId: string, userId: string): string {
  return `roulette:settlement:${roundId}:${userId}`;
}

export function rouletteBetIdempotencyKey(userId: string, key: string): string {
  return `roulette:bet:${userId}:${key}`;
}

export async function debitRouletteBet(
  deps: { debitForUser: Function },
  req: any,
  amount: number,
  description: string,
  idempotencyKey: string,
) {
  return deps.debitForUser(req, amount, description, 'roulette', idempotencyKey);
}

export async function creditRoulettePayout(
  deps: { creditForUser: Function },
  req: any,
  amount: number,
  description: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return deps.creditForUser(req, amount, description, 'roulette');
}

export async function refundRouletteBet(
  deps: { supabaseRepo: any },
  userId: string,
  amount: number,
  description: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return deps.supabaseRepo.atomicCredit(userId, amount, description, 'roulette');
}
