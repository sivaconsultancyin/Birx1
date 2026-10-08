import crypto from 'node:crypto';
import { AVIATOR_ROOM_ID, INITIAL_AVIATOR_STATE, AVIATOR_BETTING_SECONDS, AVIATOR_RESULT_DELAY_MS } from './constants.ts';
import { hashSeed, generateCrashPoint } from './fairness.ts';
import { AVIATOR_SOCKET_EVENTS } from './socket.ts';
import { registerAviatorRoutes } from './routes/aviatorRoutes.ts';
import { calculateAviatorPayout, createAviatorLossOutcome, createAviatorWinOutcome } from './settlement.ts';
import type { AviatorBet, AviatorState } from './types/aviatorTypes.ts';
import type { Wallet } from '../../types.ts';
import type { Request, Response } from 'express';

export interface AviatorGameDeps {
  supabaseRepo: any;
  requireAuth: any;
  requirePlayerForGames: any;
  walletService: any;
  recordHistory: any;
  broadcastRealtime: any;
  acquireGameLease: any;
  safeSaveAuthoritativeGameState: any;
  safeGetAuthoritativeGameState: any;
  debitForUser: any;
  creditForUser: any;
  getRequestUser?: any;
}

export function registerAviatorGame(app: any, deps: AviatorGameDeps) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, recordHistory, broadcastRealtime, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, debitForUser, creditForUser } = deps;

// -------------------------------------------------------------


let aviatorState: AviatorState = { ...INITIAL_AVIATOR_STATE, roundId: 'AV-' + crypto.randomInt(1000, 10000) };

const aviatorBets = new Map<string, AviatorBet>();
const aviatorRoundStats = new Map<string, { totalBets: number; totalBetAmount: number; totalPayoutAmount: number }>();
let aviatorRoundSequence = Date.now();
let lastHydratedVersion = 0;
let authoritativeVersion = 0;
let currentServerSeed = crypto.randomBytes(32).toString('hex');
let currentServerSeedHash = hashSeed(currentServerSeed);
let currentClientSeed = 'brix1-public';
let currentNonce = 0;
let currentCrashTarget = generateCrashPoint(currentServerSeed, currentClientSeed, currentNonce);

let aviatorTimer: NodeJS.Timeout | null = null;
let lastPersistedFlightSecond = -1;
let settlementMutation: Promise<void> = Promise.resolve();
async function withSettlementMutation<T>(fn: () => Promise<T>): Promise<T> {
  const previous = settlementMutation;
  let release!: () => void;
  settlementMutation = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await fn(); } finally { release(); }
}
let flightStartedAt = 0;
let leaseHeartbeat: NodeJS.Timeout | null = null;

function stopLeaseHeartbeat() {
  if (leaseHeartbeat) clearInterval(leaseHeartbeat);
  leaseHeartbeat = null;
}

function startLeaseHeartbeat() {
  stopLeaseHeartbeat();
  leaseHeartbeat = setInterval(async () => {
    try {
      const owned = await acquireGameLease('aviator');
      if (!owned) console.warn('[Aviator] Game lease lost; waiting for the current cycle to finish.');
    } catch (e) {
      console.warn('[Aviator] Lease renewal failed; continuing current authoritative loop.', e);
    }
  }, 3000);
}

async function persistAviatorState() {
  authoritativeVersion += 1;
  await safeSaveAuthoritativeGameState('aviator', {
    ...aviatorState,
    version: authoritativeVersion,
    crashTarget: currentCrashTarget,
    serverSeed: currentServerSeed,
    serverSeedHash: currentServerSeedHash,
    clientSeed: currentClientSeed,
    nonce: currentNonce,
    activeBets: Object.fromEntries(aviatorBets.entries())
  });
}

async function hydrateAviatorState() {
  try {
    const persisted = await safeGetAuthoritativeGameState('aviator');
    if (!persisted) return;
    const { crashTarget, serverSeed, serverSeedHash, clientSeed, nonce, activeBets, ...sharedState } = persisted as any;
    const incomingVersion = Number(sharedState.version || 0);
    if (incomingVersion <= lastHydratedVersion) return;
    lastHydratedVersion = incomingVersion;
    authoritativeVersion = Math.max(authoritativeVersion, incomingVersion);
    if (sharedState.roundId) aviatorState = { ...aviatorState, ...sharedState };
    if (typeof serverSeed === 'string' && serverSeed.length > 0) currentServerSeed = serverSeed;
    if (typeof serverSeedHash === 'string' && serverSeedHash.length > 0) currentServerSeedHash = serverSeedHash;
    if (typeof clientSeed === 'string' && clientSeed.length > 0) currentClientSeed = clientSeed;
    if (Number.isFinite(Number(nonce))) currentNonce = Number(nonce);
    if (typeof crashTarget === 'number') currentCrashTarget = crashTarget;
    // Recover a missing target from the recovered fairness inputs rather than
    // mixing a persisted target with a newly generated seed.
    if (typeof crashTarget !== 'number' && currentServerSeed) {
      currentCrashTarget = generateCrashPoint(currentServerSeed, currentClientSeed, currentNonce);
    }
    if (activeBets && typeof activeBets === 'object') {
      aviatorBets.clear();
      for (const [userId, bet] of Object.entries(activeBets)) {
        aviatorBets.set(userId, bet as AviatorBet);
      }
    }
  } catch (e) {
    console.warn('[Aviator] Could not hydrate persisted room state.', e);
  }
}

async function runAviatorCycle() {
  if (aviatorTimer) clearInterval(aviatorTimer);
  stopLeaseHeartbeat();

  // Exactly one process owns the authoritative Aviator room when Supabase is configured.
  // Other processes wait and retry instead of creating competing rounds.
  const hasLease = await acquireGameLease('aviator');
  if (!hasLease) {
    setTimeout(() => { void runAviatorCycle(); }, 1000);
    return;
  }
  startLeaseHeartbeat();

  // Phase 1: Betting (5 seconds countdown)
  aviatorState.phase = 'betting';
  aviatorState.multiplier = 1.0;
  aviatorState.crashMultiplier = null;
  aviatorState.countdown = 5;
  aviatorState.roundId = 'AV-' + crypto.randomInt(1000, 10000) + '-' + crypto.randomUUID().slice(0, 8);
  lastPersistedFlightSecond = -1;
  aviatorRoundSequence += 1;
  aviatorRoundStats.set(aviatorState.roundId, { totalBets: 0, totalBetAmount: 0, totalPayoutAmount: 0 });
  // Generate and commit the fairness material before recording the round so the
  // DB hash belongs to this exact round, never the previous one.
  currentServerSeed = crypto.randomBytes(32).toString('hex');
  currentServerSeedHash = hashSeed(currentServerSeed);
  currentNonce = aviatorRoundSequence;
  currentCrashTarget = generateCrashPoint(currentServerSeed, currentClientSeed, currentNonce);
  await supabaseRepo.recordGameRound(aviatorState.roundId, 'aviator', 'betting', { startedAt: new Date().toISOString(), roomId: AVIATOR_ROOM_ID }, aviatorRoundSequence, currentServerSeedHash);

  broadcastRealtime('round_started', { gameId: 'aviator', roomId: AVIATOR_ROOM_ID, roundId: aviatorState.roundId });

  await persistAviatorState();

  const betInterval = setInterval(async () => {
    aviatorState.countdown -= 1;
    if (aviatorState.countdown <= 0) {
      clearInterval(betInterval);
      void startAviatorFlight();
    } else {
      broadcastRealtime('aviator_tick', {
        gameId: 'aviator',
        roomId: AVIATOR_ROOM_ID,
        roundId: aviatorState.roundId,
        phase: aviatorState.phase,
        multiplier: aviatorState.multiplier,
        countdown: aviatorState.countdown,
        serverTime: Date.now()
      });
    }
    await persistAviatorState();
  }, 1000);
}

async function startAviatorFlight() {
  aviatorState.phase = 'running';
  flightStartedAt = Date.now();
  aviatorState.multiplier = 1.0;

  // Publish the running state immediately so authoritative API readers cannot
  // skip directly from betting to crashed/next-round on very short crash points.
  await persistAviatorState();

  await supabaseRepo.recordGameRound(aviatorState.roundId, 'aviator', 'in_flight', { startedAt: new Date().toISOString(), roomId: AVIATOR_ROOM_ID }, aviatorRoundSequence, currentServerSeedHash);

  broadcastRealtime('betting_closed', { gameId: 'aviator', roomId: AVIATOR_ROOM_ID, roundId: aviatorState.roundId });

  const startTime = flightStartedAt || Date.now();
  const flightInterval = setInterval(async () => {
    const elapsedSec = (Date.now() - startTime) / 1000;
    // Exponential curve: 1 + 0.06 * t^1.7
    const nextMult = Number((1.0 + 0.06 * Math.pow(elapsedSec * 1.8, 1.6)).toFixed(2));

    if (nextMult >= currentCrashTarget) {
      clearInterval(flightInterval);
      await withSettlementMutation(async () => {
      aviatorState.multiplier = currentCrashTarget;
      aviatorState.crashMultiplier = currentCrashTarget;
      aviatorState.phase = 'crashed';
      aviatorState.previousMultipliers.unshift(currentCrashTarget);
      if (aviatorState.previousMultipliers.length > 15) aviatorState.previousMultipliers.pop();

      // If user had an active bet that didn't cash out -> settled as loss
      for (const [userId, currentAviatorBet] of aviatorBets) {
        if (!currentAviatorBet.cashedOut) {
          try { await supabaseRepo.settleGameBet(currentAviatorBet.betId, 'lost', currentCrashTarget, 0); }
          catch (e) { console.error('[Aviator] Failed to persist lost bet:', e); }

          recordHistory({
          gameId: 'aviator',
          gameName: 'Aviator',
          betAmount: currentAviatorBet.amount,
          winAmount: 0,
          outcome: createAviatorLossOutcome(currentCrashTarget),
          multiplier: 0,
          settlementStatus: 'settled'
        });
        aviatorBets.delete(userId);
        }
      }
      });

      broadcastRealtime('result', {
        gameId: 'aviator',
        roomId: AVIATOR_ROOM_ID,
        roundId: aviatorState.roundId,
        multiplier: currentCrashTarget,
        crashed: true,
        previousMultipliers: [...aviatorState.previousMultipliers],
        phase: 'crashed',
        countdown: 0
      });

      const roundStats = aviatorRoundStats.get(aviatorState.roundId) || { totalBets: 0, totalBetAmount: 0, totalPayoutAmount: 0 };
      try {
        await supabaseRepo.recordGameRound(aviatorState.roundId, 'aviator', 'result', { crashMultiplier: currentCrashTarget, finishedAt: new Date().toISOString(), roomId: AVIATOR_ROOM_ID }, aviatorRoundSequence);
        await supabaseRepo.recordSettlement({
        id: `av_settlement_${aviatorState.roundId}`,
        roundId: aviatorState.roundId,
        gameId: 'aviator',
        totalBetsCount: roundStats.totalBets,
        totalBetAmount: roundStats.totalBetAmount,
        totalPayoutAmount: roundStats.totalPayoutAmount,
        netHouseResult: roundStats.totalBetAmount - roundStats.totalPayoutAmount,
        outcomeSummary: `Aviator crashed at ${currentCrashTarget}x`,
        details: { crashMultiplier: currentCrashTarget, roomId: AVIATOR_ROOM_ID }
      });
        await supabaseRepo.recordGameRound(aviatorState.roundId, 'aviator', 'settled', { crashMultiplier: currentCrashTarget, settlementId: `av_settlement_${aviatorState.roundId}`, roomId: AVIATOR_ROOM_ID }, aviatorRoundSequence);
      } catch (e) {
        console.error('[Aviator] Round audit persistence failed; live game result remains authoritative:', e);
      }
      aviatorRoundStats.delete(aviatorState.roundId);

      // Persist the terminal state, then start the next round in the same permanent room.
      await persistAviatorState();
      stopLeaseHeartbeat();
      setTimeout(() => { void runAviatorCycle(); }, AVIATOR_RESULT_DELAY_MS);
    } else {
      aviatorState.multiplier = nextMult;
      // WebSocket is the primary high-frequency live transport. Supabase persistence
      // remains available for authoritative resync, but clients do not poll it.
      const serverTime = Date.now();
      broadcastRealtime('aviator_tick', {
        gameId: 'aviator', roomId: AVIATOR_ROOM_ID, roundId: aviatorState.roundId,
        phase: aviatorState.phase, multiplier: aviatorState.multiplier,
        countdown: aviatorState.countdown, serverTime, flightStartedAt
      });
      // Do not write the database 10 times/second. The backend remains authoritative;
      // persist checkpoints once per elapsed second for recovery/resync.
      const elapsedSecond = Math.floor(elapsedSec);
      if (elapsedSecond !== lastPersistedFlightSecond) {
        lastPersistedFlightSecond = elapsedSecond;
        await persistAviatorState();
      }
    }
  }, 100);
}

// Start initial aviator flight cycle
runAviatorCycle();



// -------------------------------------------------------------

}
