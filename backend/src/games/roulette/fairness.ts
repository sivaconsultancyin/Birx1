import crypto from 'node:crypto';
import { EUROPEAN_WHEEL } from './constants.ts';

export function createRouletteFairRound() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return {
    serverSeed,
    serverSeedHash,
    clientSeed: crypto.randomBytes(16).toString('hex'),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
}

export function deriveRouletteOutcome(serverSeed: string, clientSeed: string, nonce: string) {
  const digest = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest();
  return EUROPEAN_WHEEL[digest.readUInt32BE(0) % EUROPEAN_WHEEL.length];
}

export function verifyRouletteFairResult(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: string,
  winningNumber: number,
) {
  const computedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  const derivedNumber = deriveRouletteOutcome(serverSeed, clientSeed, nonce);
  return computedHash === serverSeedHash && derivedNumber === winningNumber;
}
