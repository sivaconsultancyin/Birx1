import type { RouletteBet } from '../../types.ts';
import { ROULETTE_LIMITS } from './constants.ts';

const OUTSIDE_TYPES = new Set<RouletteBetType>([
  'dozen1','dozen2','dozen3','col1','col2','col3','red','black','even','odd','low','high'
]);
const COMBINATION_LENGTHS: Record<string, number> = { split: 2, street: 3, corner: 4, sixline: 6 };

function nums(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new Error('Roulette number combination is required');
  const v = raw.map(Number);
  if (v.some(n => !Number.isInteger(n) || n < 0 || n > 36)) throw new Error('Roulette numbers must be integers from 0 to 36');
  if (new Set(v).size !== v.length) throw new Error('Roulette number combination cannot contain duplicates');
  return v;
}
function splitAdjacent(a: number,b: number): boolean {
  if (a === 0 || b === 0) return (a === 0 && (b === 1 || b === 2)) || (b === 0 && (a === 1 || a === 2));
  const ra=Math.floor((a-1)/3), ca=(a-1)%3, rb=Math.floor((b-1)/3), cb=(b-1)%3;
  return Math.abs(ra-rb)+Math.abs(ca-cb)===1;
}
function validateCombination(type: RouletteBetType, raw: unknown): void {
  const n=nums(raw), expected=COMBINATION_LENGTHS[type];
  if (n.length !== expected) throw new Error(type + ' bet must contain exactly ' + expected + ' numbers');
  const s=[...n].sort((a,b)=>a-b);
  if (type==='split') {
    if (!splitAdjacent(s[0],s[1])) throw new Error('Invalid European Roulette split');
  } else if (type==='street') {
    if (s[0] < 1 || s[0] > 34 || (s[0]-1)%3!==0 || s.join(',') !== [s[0],s[0]+1,s[0]+2].join(',')) throw new Error('Invalid European Roulette street');
  } else if (type==='corner') {
    if (s[0] < 1 || s[0] > 32 || (s[0]-1)%3===2 || s.join(',') !== [s[0],s[0]+1,s[0]+3,s[0]+4].join(',')) throw new Error('Invalid European Roulette corner');
  } else if (type==='sixline') {
    if (s[0] < 1 || s[0] > 31 || (s[0]-1)%3!==0 || s.join(',') !== [s[0],s[0]+1,s[0]+2,s[0]+3,s[0]+4,s[0]+5].join(',')) throw new Error('Invalid European Roulette six-line');
  }
}
function validateRouletteBetGeometry(bet: RouletteBet): void {
  if (!bet?.type) throw new Error('Roulette bet type is required');
  if (bet.type==='straight' || bet.type==='number') {
    const target=bet.value ?? bet.numbers?.[0];
    if (!Number.isInteger(target) || target < 0 || target > 36) throw new Error('Straight-up Roulette bet must target one number from 0 to 36');
    if (bet.numbers !== undefined && (nums(bet.numbers).length !== 1 || nums(bet.numbers)[0] !== target)) throw new Error('Invalid straight-up Roulette numbers');
  } else if (bet.type in COMBINATION_LENGTHS) {
    validateCombination(bet.type, bet.numbers);
  } else if (OUTSIDE_TYPES.has(bet.type)) {
    if (bet.numbers?.length || bet.value !== undefined) throw new Error(bet.type + ' bet must not contain number/value');
  } else throw new Error('Unsupported Roulette bet type');
}

export function validateRouletteBetAmount(amount: number): void {
  if (!Number.isFinite(amount)) throw new Error('Invalid roulette bet amount');
  if (amount < ROULETTE_LIMITS.minimumBet) throw new Error(`Minimum bet is ₹${ROULETTE_LIMITS.minimumBet}`);
  if (amount > ROULETTE_LIMITS.maximumBet) throw new Error(`Maximum bet per spot is ₹${ROULETTE_LIMITS.maximumBet}`);
}

export function validateRouletteBets(bets: RouletteBet[]): number {
  if (!Array.isArray(bets) || bets.length === 0) throw new Error('At least one bet is required');
  let total = 0;
  for (const bet of bets) {
    validateRouletteBetGeometry(bet);
    const amount = Number(bet.amount || 0);
    validateRouletteBetAmount(amount);
    total += amount;
  }
  if (total > ROULETTE_LIMITS.maximumExposure) {
    throw new Error(`Maximum round exposure is ₹${ROULETTE_LIMITS.maximumExposure}`);
  }
  return total;
}

export function attachRouletteUser(bets: RouletteBet[], userId: string, placedAt: string) {
  return bets.map((bet) => ({ ...bet, userId, placedAt }));
}
