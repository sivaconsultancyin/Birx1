import crypto from 'node:crypto';
import { EUROPEAN_WHEEL, DEFAULT_ROULETTE_CLIENT_SEED } from './constants.ts';
export function createRouletteFairRound() {
export   const serverSeed = crypto.randomBytes(32).toString('hex');
export   const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
export   return { serverSeed, serverSeedHash, clientSeed: DEFAULT_ROULETTE_CLIENT_SEED, nonce: crypto.randomBytes(16).toString('hex') };
export }
export 
export function deriveRouletteOutcome(serverSeed: string, clientSeed: string, nonce: string) {
export   const digest = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest();
export   return EUROPEAN_WHEEL[digest.readUInt32BE(0) % EUROPEAN_WHEEL.length];
export }
export 
export function verifyRouletteFairResult(serverSeed: string, serverSeedHash: string, clientSeed: string, nonce: string, winningNumber: number) {
export   const computedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
export   const derivedNumber = deriveRouletteOutcome(serverSeed, clientSeed, nonce);
export   return computedHash === serverSeedHash && derivedNumber === winningNumber;
export }