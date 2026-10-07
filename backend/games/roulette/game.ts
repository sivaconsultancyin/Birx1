import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { RouletteBet, RouletteState, Wallet } from '../../types.ts';
import { GAME_ROOM_ID, EUROPEAN_WHEEL, RED_NUMBERS, BLACK_NUMBERS, ROULETTE_LIMITS, DEFAULT_ROULETTE_CLIENT_SEED, ROULETTE_PAYOUT_RULES, type ServerRouletteBet } from './constants.ts';
import { createRouletteFairRound, deriveRouletteOutcome, verifyRouletteFairResult } from './fairness.ts';
import { computeRouletteSettlement } from './settlement.ts';
import { rouletteBetIdempotencyKey } from './wallet.ts';
import { validateRouletteBets, attachRouletteUser } from './bets.ts';
import { ROULETTE_SOCKET_EVENTS, emitRouletteEvent } from './socket.ts';

/** Server-authoritative roulette module. All shared infrastructure is injected by the thin router. */

export function registerRouletteGame(app: any, deps: any) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService, recordHistory, broadcastRealtime, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, getRequestUser } = deps;

// -------------------------------------------------------------
function newRouletteRoundId(): string {
  return `RL-${crypto.randomUUID()}`;
}
const initialFairRound = createRouletteFairRound();

let rouletteState: RouletteState = {
  roomId: GAME_ROOM_ID,
  roundId: newRouletteRoundId(),
  phase: 'betting',
  countdown: 15,
  winningNumber: null,
  winningColor: null,
  winningCategory: '',
  recentResults: [],
  serverSeedHash: initialFairRound.serverSeedHash,
  minimumBet: ROULETTE_LIMITS.minimumBet,
  maximumBet: ROULETTE_LIMITS.maximumBet,
  maximumExposure: ROULETTE_LIMITS.maximumExposure
};

let rouletteFairRound = initialFairRound;

// Absolute server deadline for the current phase. It is persisted so a restart
// resumes from the same authoritative clock instead of starting a fresh 15s timer.
let roulettePhaseEndsAt = Date.now() + Math.max(1, Number(rouletteState.countdown || 15)) * 1000;

// Tracks whether the authoritative Roulette room has been initialized.
let rouletteRoomReady = false;

// Memory stores for Roulette
const currentRoundBets: Record<string, ServerRouletteBet[]> = {};
const roundSettlements: Record<string, any> = {};
const processedRouletteIdempotency = new Map<string, any>();

const MAX_IN_MEMORY_ROULETTE_ROUNDS = 25;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function cleanupRouletteMemory() {
  const keepRounds = new Set<string>([
    rouletteState.roundId,
    ...Object.keys(currentRoundBets).slice(-MAX_IN_MEMORY_ROULETTE_ROUNDS),
    ...Object.keys(roundSettlements).slice(-MAX_IN_MEMORY_ROULETTE_ROUNDS)
  ]);

  for (const roundId of Object.keys(currentRoundBets)) {
    if (!keepRounds.has(roundId)) delete currentRoundBets[roundId];
  }
  const settlementIds = Object.keys(roundSettlements);
  for (const roundId of settlementIds.slice(0, Math.max(0, settlementIds.length - MAX_IN_MEMORY_ROULETTE_ROUNDS))) {
    delete roundSettlements[roundId];
  }

  const now = Date.now();
  for (const [key, value] of processedRouletteIdempotency.entries()) {
    const createdAt = Number(value?.createdAt || value?.timestamp || 0);
    if (createdAt > 0 && now - createdAt > IDEMPOTENCY_TTL_MS) processedRouletteIdempotency.delete(key);
  }
  while (processedRouletteIdempotency.size > 5000) {
    const oldest = processedRouletteIdempotency.keys().next().value;
    if (oldest === undefined) break;
    processedRouletteIdempotency.delete(oldest);
  }
}

function serializeRoulettePersistence() {
  return {
    ...rouletteState,
    endsAt: roulettePhaseEndsAt,
    fairRound: rouletteFairRound,
    currentRoundBets,
    roundSettlements,
    processedRouletteIdempotency: Object.fromEntries(processedRouletteIdempotency.entries())
  };
}

function hydrateRoulettePersistence(persisted: any) {
  if (!persisted || typeof persisted !== 'object') return;
  const {
    fairRound: persistedFairRound,
    currentRoundBets: persistedBets,
    roundSettlements: persistedSettlements,
    processedRouletteIdempotency: persistedIdempotency,
    ...state
  } = persisted;

  if (state.roundId) rouletteState = { ...rouletteState, ...state };
  const persistedEndsAt = Number((persisted as any).endsAt);
  if (Number.isFinite(persistedEndsAt) && persistedEndsAt > 0) {
    roulettePhaseEndsAt = persistedEndsAt;
  }

  if (
    persistedFairRound &&
    typeof persistedFairRound.serverSeed === 'string' &&
    typeof persistedFairRound.serverSeedHash === 'string' &&
    typeof persistedFairRound.clientSeed === 'string' &&
    typeof persistedFairRound.nonce === 'string'
  ) {
    rouletteFairRound = persistedFairRound;
  }

  if (persistedBets && typeof persistedBets === 'object') {
    for (const [roundId, bets] of Object.entries(persistedBets)) {
      if (Array.isArray(bets)) currentRoundBets[roundId] = bets as ServerRouletteBet[];
    }
  }
  if (persistedSettlements && typeof persistedSettlements === 'object') {
    Object.assign(roundSettlements, persistedSettlements);
  }
  if (persistedIdempotency && typeof persistedIdempotency === 'object') {
    processedRouletteIdempotency.clear();
    for (const [key, value] of Object.entries(persistedIdempotency)) {
      processedRouletteIdempotency.set(key, value);
    }
  }
}
const rouletteHistoryRecords: {
  roundId: string;
  number: number;
  color: 'red' | 'black' | 'green';
  timestamp: string;
}[] = [];

const initializeRouletteRoom = async () => {
  try {
    const persistedRoulette = await safeGetAuthoritativeGameState('roulette');
    if (persistedRoulette) {
      hydrateRoulettePersistence(persistedRoulette);
    } else {
      await safeSaveAuthoritativeGameState('roulette', serializeRoulettePersistence());
    }
  } catch (error) {
    console.error('[Roulette] failed to initialize shared room state', error);
  } finally {
    rouletteRoomReady = true;
  }
};

void initializeRouletteRoom();

// Background Authoritative Roulette Round Cycle.
// Use absolute deadlines instead of decrementing a counter once per setInterval tick.
// Async DB/lease work may take >1s; elapsed-time deadlines prevent cumulative drift
// between the table countdown and the actual phase transition.
let rouletteCycleBusy = false;
let rouletteSettlementPending = false;

cleanupRouletteMemory();
setInterval(async () => {
  if (rouletteCycleBusy || !rouletteRoomReady) return;
  rouletteCycleBusy = true;
  try {
    if (!(await acquireGameLease('roulette'))) return;
  const persistedRoulette = await safeGetAuthoritativeGameState('roulette');
  if (persistedRoulette) hydrateRoulettePersistence(persistedRoulette);
  if (rouletteState.phase === 'betting') {
    rouletteState.countdown = Math.max(0, Math.ceil((roulettePhaseEndsAt - Date.now()) / 1000));
    if (rouletteState.countdown <= 0) {
      // The betting deadline is the spin deadline. Do not insert a separate
      // client-visible "closed" phase: the table countdown reaching zero must
      // transition to the wheel on the same authoritative server tick.
      rouletteState.phase = 'spinning';
      rouletteState.countdown = 6;
      roulettePhaseEndsAt = Date.now() + 6000;

      // Persist the phase/deadline before notifying clients so reconnects cannot
      // create a second clock or skip the authoritative spin phase.
      await safeSaveAuthoritativeGameState('roulette', serializeRoulettePersistence());

      // Authoritative RNG generation strictly on server before spin starts
      const winningNum = deriveRouletteOutcome(rouletteFairRound.serverSeed, rouletteFairRound.clientSeed, rouletteFairRound.nonce);
      rouletteState.winningNumber = winningNum;
      rouletteState.winningColor = winningNum === 0 ? 'green' : RED_NUMBERS.includes(winningNum) ? 'red' : 'black';

      // Start the wheel immediately at the authoritative deadline. DB persistence
      // runs in the background and must not add visible latency.
      emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.spinStarted, {
        roundId: rouletteState.roundId,
        countdown: 6,
        endsAt: roulettePhaseEndsAt,
        winningNumber: winningNum,
        winningColor: rouletteState.winningColor
      });
      void supabaseRepo.recordGameRound(
        rouletteState.roundId,
        'roulette',
        'spinning',
        { roomId: GAME_ROOM_ID, countdown: 6 },
        Date.now()
      ).catch((error: unknown) => console.error('[Roulette] failed to persist spinning phase', error));
    }
  } else if (rouletteState.phase === 'spinning') {
    rouletteState.countdown = Math.max(0, Math.ceil((roulettePhaseEndsAt - Date.now()) / 1000));
    if (rouletteState.countdown <= 0) {
      rouletteState.phase = 'result';
      rouletteState.countdown = 4;
      roulettePhaseEndsAt = Date.now() + 4000;
      await safeSaveAuthoritativeGameState('roulette', serializeRoulettePersistence());

      const currentRoundId = rouletteState.roundId;
      const winningNum = rouletteState.winningNumber ?? 0;
      // Settlement is authoritative. The public result event is emitted only
      // after the DB settlement commits below, so clients never observe a
      // result that could later roll back.
      void supabaseRepo.recordGameRound(
        currentRoundId,
        'roulette',
        'result',
        { roomId: GAME_ROOM_ID, countdown: 4 },
        Date.now()
      ).catch((error: unknown) => console.error('[Roulette] failed to persist result phase', error));

      // Supabase is authoritative. Memory is only a fast fallback for local/dev mode.
      let persistedBets: any[] = [];
      try {
        persistedBets = await supabaseRepo.getRoundBets(currentRoundId, 'roulette');
      } catch (error) {
        console.error(`[RouletteSettlement:${currentRoundId}] failed to load persisted bets`, error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
      }

      if (process.env.NODE_ENV === 'production' && persistedBets.length === 0) {
        // A production settlement must never silently fall back to process memory.
        // An empty DB read can otherwise turn a real debit into an unsettled bet.
        const hasAnyBets = (currentRoundBets[currentRoundId] || []).length > 0;
        if (hasAnyBets) throw new Error('Roulette persisted bets unavailable; settlement must retry');
      }

      const bets: ServerRouletteBet[] = persistedBets.map((row: any) => ({
            type: row.bet_type,
            value: row.bet_value?.value ?? undefined,
            numbers: row.bet_value?.numbers ?? undefined,
            amount: Number(row.amount),
            userId: row.user_id,
            placedAt: row.created_at
        }));

      if (!verifyRouletteFairResult(rouletteFairRound.serverSeed, rouletteFairRound.serverSeedHash, rouletteFairRound.clientSeed, rouletteFairRound.nonce, winningNum)) {
        throw new Error(`Roulette fairness verification failed for round ${currentRoundId}`);
      }

      const settlement = computeRouletteSettlement(winningNum, bets);
      const playerSettlements: Record<string, any> = {};

      const userIds = [...new Set(bets.map((bet) => bet.userId).filter(Boolean))];
      for (const userId of userIds) {
        const playerBets = bets.filter((bet) => bet.userId === userId);
        playerSettlements[userId] = computeRouletteSettlement(winningNum, playerBets);
      }

      if (persistedBets.length) {
        const winningBets = persistedBets
          .map(row => {
            const rowBet = {
              type: row.bet_type,
              value: row.bet_value?.value ?? undefined,
              numbers: row.bet_value?.numbers ?? undefined,
              amount: Number(row.amount)
            };
            const one = computeRouletteSettlement(winningNum, [rowBet]);
            return {
              id: row.id,
              userId: row.user_id,
              amount: Number(row.amount),
              payout: one.grossPayout,
              multiplier: one.grossPayout > 0 ? Number((one.grossPayout / Number(row.amount)).toFixed(2)) : 0
            };
          });
        const winningIds = new Set(winningBets.filter(b => b.payout > 0).map(b => b.id));
        const losingBetIds = persistedBets.filter(row => !winningIds.has(row.id)).map(row => row.id);

        try {
          let settlementCommitted = false;
          let lastSettlementError: unknown = null;
          for (let attempt = 1; attempt <= 3 && !settlementCommitted; attempt++) {
            try {
              await supabaseRepo.atomicSettleRouletteRound({
                roundId: currentRoundId,
                resultData: {
                  winningNumber: winningNum,
                  winningColor: settlement.winningColor,
                  winningCategory: settlement.winningCategory,
                  playerSettlements,
                  provablyFair: {
                    serverSeed: rouletteFairRound.serverSeed,
                    serverSeedHash: rouletteFairRound.serverSeedHash,
                    clientSeed: rouletteFairRound.clientSeed,
                    nonce: rouletteFairRound.nonce,
                    winningNumber: winningNum
                  }
                },
                winningBets,
                losingBetIds,
                outcomeSummary: `Landed on ${winningNum} ${settlement.winningColor.toUpperCase()}`
              });
              settlementCommitted = true;
            } catch (error) {
              lastSettlementError = error;
              console.error(`[RouletteSettlement:${currentRoundId}] atomic attempt ${attempt}/3 failed`, error);
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 500));
            }
          }
          if (!settlementCommitted) {
            rouletteSettlementPending = true;
            throw lastSettlementError || new Error('Roulette settlement failed');
          }
          rouletteSettlementPending = false;

          for (const playerId of userIds) {
            const playerSettlement = playerSettlements[playerId];
            emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.playerResult, {
              userId: playerId,
              roundId: currentRoundId,
              winningNumber: winningNum,
              totalBet: playerSettlement.totalBet,
              grossPayout: playerSettlement.grossPayout,
              netResult: playerSettlement.netResult,
              isWin: playerSettlement.grossPayout > 0,
              settlementStatus: 'settled',
              endsAt: roulettePhaseEndsAt
            });
            if (playerSettlement.grossPayout > 0) {
              try {
                const wallet = await supabaseRepo.getWallet(playerId);
                emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.walletUpdated, {
                  userId: playerId,
                  wallet,
                  roundId: currentRoundId
                });
              } catch (walletError) {
                console.error(`[RouletteSettlement:${currentRoundId}] failed to refresh wallet for ${playerId}`, walletError);
              }
            }
          }
        } catch (error) {
          // The RPC is transactional: wallet credits, bet statuses, round
          // settlement and settlement row roll back together on failure.
          console.error(`[RouletteSettlement:${currentRoundId}] atomic settlement failed`, error);
          throw error;
        }
      }

      rouletteState.winningCategory = settlement.winningCategory;
      rouletteState.recentResults.unshift(winningNum);
      if (rouletteState.recentResults.length > 20) rouletteState.recentResults.pop();

      rouletteHistoryRecords.unshift({
        roundId: rouletteState.roundId,
        number: winningNum,
        color: settlement.winningColor,
        timestamp: new Date().toISOString()
      });
      if (rouletteHistoryRecords.length > 50) rouletteHistoryRecords.pop();

      if (settlement.grossPayout > 0) {
        // Wallet settlement is request-scoped; background cycle never credits an unknown user.
      }

      if (settlement.totalBet > 0) {
        recordHistory({
          gameId: 'roulette',
          gameName: 'Roulette',
          betAmount: settlement.totalBet,
          winAmount: settlement.grossPayout,
          outcome: `Landed on ${winningNum} ${settlement.winningColor.toUpperCase()}`,
          multiplier: settlement.totalBet > 0 ? Number((settlement.grossPayout / settlement.totalBet).toFixed(2)) : 0,
          settlementStatus: 'settled'
        });
      }

      roundSettlements[rouletteState.roundId] = {
        roundId: rouletteState.roundId,
        provablyFair: {
          serverSeed: rouletteFairRound.serverSeed,
          serverSeedHash: rouletteFairRound.serverSeedHash,
          clientSeed: rouletteFairRound.clientSeed,
          nonce: rouletteFairRound.nonce,
          winningNumber: winningNum
        },
        winningNumber: winningNum,
        winningColor: settlement.winningColor,
        winningCategory: settlement.winningCategory,
        winningBets: settlement.winningBets,
        losingBets: settlement.losingBets,
        totalBet: settlement.totalBet,
        grossPayout: settlement.grossPayout,
        netResult: settlement.netResult,
        settlementStatus: 'settled',
        wallet: undefined,
        recentResults: rouletteState.recentResults,
        playerSettlements
      };

      emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.result, {
        roundId: rouletteState.roundId,
        winningNumber: winningNum,
        winningColor: settlement.winningColor,
        winningCategory: settlement.winningCategory
      });
      await supabaseRepo.recordGameRound(
        currentRoundId,
        'roulette',
        'settled',
        { roomId: GAME_ROOM_ID, winningNumber: winningNum, winningColor: settlement.winningColor, winningCategory: settlement.winningCategory },
        Date.now()
      );
      // Settlement is public room state only. Player-specific amounts/results are
      // sent through the targeted roulette_player_result event above; never broadcast
      // the full playerSettlements map to every client.
      emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.settlement, {
        roundId: currentRoundId,
        winningNumber: winningNum,
        winningColor: settlement.winningColor,
        winningCategory: settlement.winningCategory,
        settlementStatus: 'settled',
        recentResults: rouletteState.recentResults
      });
      // Do not broadcast a wallet update without a userId. Wallet changes are
      // already sent as targeted events above; an anonymous/public room must never
      // receive another player's wallet signal.

    }
  } else if (rouletteState.phase === 'result') {
    if (rouletteSettlementPending) {
      rouletteState.countdown = 1;
      roulettePhaseEndsAt = Date.now() + 1000;
      return;
    }
    // Keep result timing on the same absolute server clock used by every
    // other phase. The cycle runs every 100ms, so decrementing by 1 here
    // would otherwise end a 4-second result phase in roughly 400ms.
    rouletteState.countdown = Math.max(0, Math.ceil((roulettePhaseEndsAt - Date.now()) / 1000));
    if (rouletteState.countdown <= 0) {
      // Transition to new round
      const newRoundId = newRouletteRoundId();
      rouletteState.roundId = newRoundId;
      cleanupRouletteMemory();
      rouletteState.phase = 'betting';
      rouletteState.countdown = 15;
      roulettePhaseEndsAt = Date.now() + 15000;
      rouletteFairRound = createRouletteFairRound();
      await supabaseRepo.recordGameRound(
        newRoundId,
        'roulette',
        'betting',
        { roomId: GAME_ROOM_ID, countdown: 15, startedAt: new Date().toISOString() },
        Date.now()
      );
      rouletteState.serverSeedHash = rouletteFairRound.serverSeedHash;
      currentRoundBets[newRoundId] = [];
      await safeSaveAuthoritativeGameState('roulette', serializeRoulettePersistence());

      emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.roundStarted, {
        roundId: newRoundId,
        countdown: 15,
        endsAt: roulettePhaseEndsAt
      });
      emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.bettingOpen, {
        roundId: newRoundId,
        countdown: 15,
        endsAt: roulettePhaseEndsAt
      });
    }
  }
    await safeSaveAuthoritativeGameState('roulette', serializeRoulettePersistence());
  } finally {
    rouletteCycleBusy = false;
  }
}, 100);


// 1. GET Rules
const handleGetRouletteRules = (_req: Request, res: Response) => {
  res.json({
    game: 'European Roulette',
    pockets: 37,
    wheelOrder: EUROPEAN_WHEEL,
    limits: ROULETTE_LIMITS,
    payouts: ROULETTE_PAYOUT_RULES,
    zeroRule: '0 is Green. When 0 hits, all outside bets (Red/Black, Odd/Even, Low/High, Dozens, Columns) lose. Only bets covering 0 win.'
  });
};
app.get('/api/games/roulette/rules', requireAuth, requirePlayerForGames, handleGetRouletteRules);

// 2. GET Round / State
const handleGetRouletteRound = (_req: Request, res: Response) => {
  const publicWinningNumber = rouletteState.phase === 'result' ? rouletteState.winningNumber : null;
  const publicWinningColor = rouletteState.phase === 'result' ? rouletteState.winningColor : null;
  const publicWinningCategory = rouletteState.phase === 'result' ? rouletteState.winningCategory : null;
  const publicState = { ...rouletteState, winningNumber: publicWinningNumber, winningColor: publicWinningColor, winningCategory: publicWinningCategory };
  res.json({
    state: publicState,
    roundId: rouletteState.roundId,
    phase: rouletteState.phase,
    countdown: rouletteState.countdown,
    endsAt: roulettePhaseEndsAt,
    winningNumber: publicWinningNumber,
    winningColor: publicWinningColor,
    winningCategory: publicWinningCategory,
    recentResults: rouletteState.recentResults,
    serverSeedHash: rouletteState.serverSeedHash,
    limits: ROULETTE_LIMITS
  });
};
app.get('/api/games/roulette/round', requireAuth, requirePlayerForGames, handleGetRouletteRound);
app.get('/api/games/roulette/state', requireAuth, requirePlayerForGames, handleGetRouletteRound);

app.get('/api/games/roulette/fairness/:roundId', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const roundId = req.params.roundId;
  let settlement = roundSettlements[roundId];
  if (!settlement?.provablyFair) {
    try {
      const persisted = await supabaseRepo.getSettlementByRound(roundId, 'roulette');
      settlement = persisted ? { provablyFair: persisted.details?.provablyFair } : null;
    } catch (error) {
      console.error('[RouletteFairness] persisted proof lookup failed', error);
    }
  }
  if (!settlement?.provablyFair) return res.status(404).json({ error: 'Fairness proof is available after settlement' });
  const proof = settlement.provablyFair;
  return res.json({
    roundId,
    ...proof,
    verified: verifyRouletteFairResult(proof.serverSeed, proof.serverSeedHash, proof.clientSeed, proof.nonce, proof.winningNumber)
  });
});

// 3. GET History & Analytics
const handleGetRouletteHistory = async (_req: Request, res: Response) => {
  try {
    const persisted = await supabaseRepo.getRouletteHistory(50);
    const records = persisted;
    const frequency = new Map<number, number>();
    records.forEach((r: any) => frequency.set(Number(r.winningNumber), (frequency.get(Number(r.winningNumber)) || 0) + 1));
    const sortedNums = [...frequency.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    return res.json({
      history: records,
      analytics: {
        hotNumbers: sortedNums.slice(0, 4),
        coldNumbers: EUROPEAN_WHEEL.filter((n) => !sortedNums.includes(n)).slice(0, 4)
      }
    });
  } catch (error) {
    console.error('[Roulette] failed to load persistent history', error);
    return res.status(503).json({ error: 'Roulette history is temporarily unavailable.' });
  }
};

app.get('/api/games/roulette/history', requireAuth, requirePlayerForGames, handleGetRouletteHistory);

// 4. POST Bets (Register bets for ongoing authoritative round)
const handlePostRouletteBets = async (req: Request, res: Response) => {
  const { bets, idempotencyKey }: { bets: RouletteBet[]; idempotencyKey?: string } = req.body;
  const userId = req.user!.id;
  const clientKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!clientKey) return res.status(400).json({ error: 'Roulette bet idempotencyKey is required' });
  const scopedKey = rouletteBetIdempotencyKey(userId, clientKey);

  if (processedRouletteIdempotency.has(scopedKey)) {
    return res.json(processedRouletteIdempotency.get(scopedKey));
  }

  let totalBet = 0;
  try {
    totalBet = validateRouletteBets(bets);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid roulette bets' });
  }

  const roundId = rouletteState.roundId;
  if (rouletteState.phase !== 'betting' || Date.now() >= roulettePhaseEndsAt) {
    return res.status(400).json({ error: 'Betting is currently closed for this round' });
  }

  try {
    const result = await supabaseRepo.atomicPlaceRouletteBets({
      userId,
      gameId: 'roulette',
      roundId,
      bets,
      idempotencyKey: scopedKey
    });

    if (!result?.success) throw new Error('Roulette bet transaction was not accepted');

    const placedAt = new Date().toISOString();
    const serverBets: ServerRouletteBet[] = bets.map((bet) => ({ ...bet, userId, placedAt }));
    currentRoundBets[roundId] = [...(currentRoundBets[roundId] || []), ...serverBets];

    const wallet = await supabaseRepo.getWallet(userId);
    const responsePayload = {
      success: true,
      roundId,
      bets: bets,
      totalBetPlaced: totalBet,
      wallet,
      countdown: rouletteState.countdown
    };

    processedRouletteIdempotency.set(scopedKey, { ...responsePayload, createdAt: Date.now() });

    // Targeted to this player only. Never broadcast another player's wallet.
    emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.walletUpdated, {
      userId,
      wallet,
      roundId
    });
    return res.json(responsePayload);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (/closed|betting|round/i.test(message)) {
      return res.status(409).json({ error: 'Betting is currently closed for this round' });
    }
    console.error('[RouletteBet] atomic placement failed', { error, roundId, userId });
    return res.status(503).json({ error: 'Roulette bet could not be persisted. No bet was accepted.' });
  }
};
app.post('/api/games/roulette/bets', requireAuth, requirePlayerForGames, handlePostRouletteBets);

// 5. GET Active Bets
const handleGetRouletteBets = async (req: Request, res: Response) => {
  const roundId = rouletteState.roundId;
  const userId = req.user!.id;
  let bets: ServerRouletteBet[] = [];

  try {
    const persisted = await supabaseRepo.getRoundBets(roundId, 'roulette');
    bets = (persisted || [])
      .filter((row: any) => row.user_id === userId)
      .map((row: any) => ({
        type: row.bet_type,
        value: row.bet_value?.value ?? undefined,
        numbers: row.bet_value?.numbers ?? undefined,
        amount: Number(row.amount),
        userId,
        placedAt: row.created_at
      }));
  } catch (error) {
    console.error('[RouletteBets] failed to load persisted active bets', error);
    return res.status(503).json({ error: 'Roulette bets are temporarily unavailable.' });
  }

  res.json({
    roundId,
    bets: bets.map(({ userId: _userId, placedAt: _placedAt, ...bet }) => bet),
    totalBet: bets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
  });
};
app.get('/api/games/roulette/bets', requireAuth, requirePlayerForGames, handleGetRouletteBets);

// 6. GET Settlement by roundId
const handleGetRouletteSettlement = async (req: Request, res: Response) => {
  const roundId = req.params.roundId || rouletteState.roundId;
  let settlement = roundSettlements[roundId];
  if (!settlement) {
    const persisted = await supabaseRepo.getSettlementByRound(roundId, 'roulette');
    if (persisted) settlement = {
      ...persisted.details,
      roundId,
      winningNumber: persisted.details?.winningNumber,
      winningColor: persisted.details?.winningColor,
      winningCategory: persisted.details?.winningCategory,
      settlementStatus: 'settled',
      playerSettlements: persisted.details?.playerSettlements || {}
    };
  }
  if (!settlement) return res.status(404).json({ error: `Settlement not found for round ${roundId}` });
  const playerSettlement = settlement.playerSettlements?.[req.user!.id];
  return res.json({ settlement: {
    roundId,
    winningNumber: settlement.winningNumber,
    winningColor: settlement.winningColor,
    winningCategory: settlement.winningCategory,
    settlementStatus: settlement.settlementStatus,
    totalBet: playerSettlement?.totalBet ?? 0,
    grossPayout: playerSettlement?.grossPayout ?? 0,
    netResult: playerSettlement?.netResult ?? 0,
    isWin: (playerSettlement?.grossPayout ?? 0) > 0
  }});
};

app.get('/api/games/roulette/settlement/:roundId', requireAuth, requirePlayerForGames, handleGetRouletteSettlement);

// 7. GET the authenticated player's settlement only.
// This is a recovery path when a WebSocket player-result event is missed.

// 7. POST Spin (Instant spin & authoritative settlement flow)


// -------------------------------------------------------------

}
