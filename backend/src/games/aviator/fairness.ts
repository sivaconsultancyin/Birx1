import crypto from 'node:crypto';

export function hashSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
}

export function deriveFairRandom(serverSeed: string, clientSeed: string, nonce: number): number {
  const message = `${clientSeed}:${nonce}`;
  const digest = crypto.createHmac('sha256', serverSeed).update(message, 'utf8').digest();
  const high32 = digest.readUInt32BE(0);
  const low20 = digest.readUInt32BE(4) >>> 12;
  return (high32 * 0x100000 + low20) / 0x10000000000000;
}

export function generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  const rand = deriveFairRandom(serverSeed, clientSeed, nonce);
  if (rand < 0.05) {
    const tieRand = deriveFairRandom(serverSeed, clientSeed, nonce + 1);
    return 1.0 + Number((tieRand * 0.15).toFixed(2));
  }
  const raw = 0.97 / (1 - rand);
  return Number(Math.max(1.05, Math.min(raw, 50.0)).toFixed(2));
}

export function createAviatorFairRound() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  return {
    serverSeed,
    serverSeedHash: hashSeed(serverSeed),
    clientSeed: 'brix1-public'
  };
}
