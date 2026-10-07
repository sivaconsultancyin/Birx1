import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { RouletteBet, RouletteState, Wallet } from '../../types.ts';
import { GAME_ROOM_ID, EUROPEAN_WHEEL, RED_NUMBERS, BLACK_NUMBERS, ROULETTE_LIMITS, DEFAULT_ROULETTE_CLIENT_SEED, ROULETTE_PAYOUT_RULES, type ServerRouletteBet } from './constants.ts';
import { createRouletteFairRound, deriveRouletteOutcome, verifyRouletteFairResult } from './fairness.ts';
import { computeRouletteSettlement } from './settlement.ts';
import { debitRouletteBet, creditRoulettePayout, refundRouletteBet, rouletteBetIdempotencyKey } from './wallet.ts';
import { validateRouletteBets, attachRouletteUser } from './bets.ts';
import { ROULETTE_SOCKET_EVENTS, emitRouletteEvent } from './socket.ts';

/** Server-authoritative roulette module. All shared infrastructure is injected by the thin router. */

export function registerRouletteGame(app: any, deps: any) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService, recordHistory, broadcastRealtime, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, debitForUser, creditForUser, getRequestUser } = deps;

// -------------------------------------------------------------
const initialFairRound = createRouletteFairRound();

let rouletteState: RouletteState = {
  roomId: GAME_ROOM_ID,
  roundId: 'RL-' + crypto.randomInt(1000, 10000),
  phase: 'betting',
  countdown: 15,
  winningNumber: 17,
  winningColor: 'black',
  winningCategory: '17 BLACK • Odd • Low (1-18) • 2nd Dozen • 2nd Col',
  recentResults: [17, 32, 0, 26, 3, 15, 28, 21, 4, 19],
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
}[] = [
  { roundId: 'RL-1090', number: 17, color: 'black', timestamp: new Date(Date.now() - 300000).toISOString() },
  { roundId: 'RL-1089', number: 32, color: 'red', timestamp: new Date(Date.now() - 360000).toISOString() },
  { roundId: 'RL-1088', number: 0, color: 'green', timestamp: new Date(Date.now() - 420000).toISOString() },
  { roundId: 'RL-1087', number: 26, color: 'black', timestamp: new Date(Date.now() - 480000).toISOString() },
  { roundId: 'RL-1086', number: 3, color: 'red', timestamp: new Date(Date.now() - 540000).toISOString() },
  { roundId: 'RL-1085', number: 15, color: 'black', timestamp: new Date(Date.now() - 600000).toISOString() },
  { roundId: 'RL-1084', number: 28, color: 'black', timestamp: new Date(Date.now() - 660000).toISOString() },
  { roundId: 'RL-1083', number: 21, color: 'red', timestamp: new Date(Date.now() - 720000).toISOString() },
  { roundId: 'RL-1082', number: 4, color: 'black', timestamp: new Date(Date.now() - 780000).toISOString() },
  { roundId: 'RL-1081', number: 19, color: 'red', timestamp: new Date(Date.now() - 840000).toISOString() }
];

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
      rouletteState.countdown = 5;
      roulettePhaseEndsAt = Date.now() + 5000;

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
        countdown: 5,
        endsAt: roulettePhaseEndsAt,
        winningNumber: winningNum,
        winningColor: rouletteState.winningColor
      });
      void supabaseRepo.recordGameRound(
        rouletteState.roundId,
        'roulette',
        'spinning',
        { roomId: GAME_ROOM_ID, countdown: 5 },
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
      // Result phase is also visible immediately; settlement/persistence follows.
      emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.result, {
        roundId: currentRoundId,
        winningNumber: winningNum,
        winningColor: rouletteState.winningColor,
        winningCategory: rouletteState.winningCategory,
        countdown: 4,
        endsAt: roulettePhaseEndsAt
      });
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
      }

      const bets: ServerRouletteBet[] = persistedBets.length
        ? persistedBets.map((row: any) => ({
            type: row.bet_type,
            value: row.bet_value?.value ?? undefined,
            numbers: row.bet_value?.numbers ?? undefined,
            amount: Number(row.amount),
            userId: row.user_id,
            placedAt: row.created_at
          }))
        : ((currentRoundBets[currentRoundId] || []) as ServerRouletteBet[]);

      const settlement = computeRouletteSettlement(winningNum, bets);
      const playerSettlements: Record<string, any> = {};

      // Bets were debited when placed. Credit each player's gross payout exactly once
      // using a deterministic idempotency key so a restart/recovery cannot double-pay.
      const userIds = [...new Set(bets.map((bet) => bet.userId).filter(Boolean))];
      for (const userId of userIds) {
        const playerBets = bets.filter((bet) => bet.userId === userId);
        const playerSettlement = computeRouletteSettlement(winningNum, playerBets);
        playerSettlements[userId] = playerSettlement;

        // Send the authoritative player outcome from the backend. The frontend
        // must not have to reconstruct settlement from local bet state.
        emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.playerResult, {
          userId,
          roundId: currentRoundId,
          winningNumber: winningNum,
          totalBet: playerSettlement.totalBet,
          grossPayout: playerSettlement.grossPayout,
          netResult: playerSettlement.netResult,
          isWin: playerSettlement.grossPayout > 0,
          settlementStatus: 'settled',
          endsAt: roulettePhaseEndsAt,
        });

        if (playerSettlement.grossPayout > 0) {
          try {
            const payoutKey = `roulette:settlement:${currentRoundId}:${userId}`;
            const credit = await supabaseRepo.atomicCredit(
              userId,
              playerSettlement.grossPayout,
              'payout',
              `Roulette Payout #${currentRoundId}`,
              'roulette',
              payoutKey
            );
            emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.walletUpdated, {
              userId,
              wallet: credit.wallet,
              roundId: currentRoundId
            });
          } catch (error) {
            console.error(`[RouletteSettlement:${currentRoundId}] payout failed for user ${userId}`, error);
          }
        }
      }

      if (persistedBets.length) {
        for (const row of persistedBets) {
          const rowBet = {
            type: row.bet_type,
            value: row.bet_value?.value ?? undefined,
            numbers: row.bet_value?.numbers ?? undefined,
            amount: Number(row.amount)
          };
          const one = computeRouletteSettlement(winningNum, [rowBet]);
          try {
            await supabaseRepo.settleGameBet(
              row.id,
              one.grossPayout > 0 ? 'won' : 'lost',
              one.grossPayout > 0 ? Number((one.grossPayout / Number(row.amount)).toFixed(2)) : 0,
              one.grossPayout
            );
          } catch (error) {
            console.error(`[RouletteSettlement:${currentRoundId}] failed to settle bet ${row.id}`, error);
          }
        }
        try {
          await supabaseRepo.recordSettlement({
            id: `roulette:${currentRoundId}`,
            roundId: currentRoundId,
            gameId: 'roulette',
            totalBetsCount: persistedBets.length,
            totalBetAmount: settlement.totalBet,
            totalPayoutAmount: settlement.grossPayout,
            netHouseResult: settlement.totalBet - settlement.grossPayout,
            outcomeSummary: `Landed on ${winningNum} ${settlement.winningColor.toUpperCase()}`,
            details: {
              winningNumber: winningNum,
              winningColor: settlement.winningColor,
              provablyFair: {
                serverSeed: rouletteFairRound.serverSeed,
                serverSeedHash: rouletteFairRound.serverSeedHash,
                clientSeed: rouletteFairRound.clientSeed,
                nonce: rouletteFairRound.nonce,
                winningNumber: winningNum
              }
            }
          });
        } catch (error) {
          console.error(`[RouletteSettlement:${currentRoundId}] failed to persist settlement summary`, error);
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
        totalBet: settlement.totalBet,
        grossPayout: settlement.grossPayout,
        netResult: settlement.netResult,
        settlementStatus: 'settled',
        recentResults: rouletteState.recentResults
      });
      // Do not broadcast a wallet update without a userId. Wallet changes are
      // already sent as targeted events above; an anonymous/public room must never
      // receive another player's wallet signal.

    }
  } else if (rouletteState.phase === 'result') {
    // Keep result timing on the same absolute server clock used by every
    // other phase. The cycle runs every 100ms, so decrementing by 1 here
    // would otherwise end a 4-second result phase in roughly 400ms.
    rouletteState.countdown = Math.max(0, Math.ceil((roulettePhaseEndsAt - Date.now()) / 1000));
    if (rouletteState.countdown <= 0) {
      // Transition to new round
      const newRoundId = 'RL-' + crypto.randomInt(1000, 10000);
      rouletteState.roundId = newRoundId;
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
const handleGetRouletteHistory = (_req: Request, res: Response) => {
  const records = rouletteHistoryRecords;
  const total = records.length || 1;
  const reds = records.filter((r) => r.color === 'red').length;
  const blacks = records.filter((r) => r.color === 'black').length;
  const greens = records.filter((r) => r.color === 'green').length;
  const odds = records.filter((r) => r.number > 0 && r.number % 2 !== 0).length;
  const evens = records.filter((r) => r.number > 0 && r.number % 2 === 0).length;
  const lows = records.filter((r) => r.number >= 1 && r.number <= 18).length;
  const highs = records.filter((r) => r.number >= 19 && r.number <= 36).length;

  // Number frequency for Hot/Cold
  const freqMap: Record<number, number> = {};
  records.forEach((r) => {
    freqMap[r.number] = (freqMap[r.number] || 0) + 1;
  });
  const sortedNums = Object.keys(freqMap)
    .map(Number)
    .sort((a, b) => freqMap[b] - freqMap[a]);

  const hotNumbers = sortedNums.slice(0, 4);
  const coldNumbers = EUROPEAN_WHEEL.filter((n) => !sortedNums.includes(n)).slice(0, 4);

  res.json({
    history: records,
    redPercentage: Math.round((reds / total) * 100),
    blackPercentage: Math.round((blacks / total) * 100),
    greenPercentage: Math.round((greens / total) * 100),
    oddPercentage: Math.round((odds / total) * 100),
    evenPercentage: Math.round((evens / total) * 100),
    lowPercentage: Math.round((lows / total) * 100),
    highPercentage: Math.round((highs / total) * 100),
    hotNumbers: hotNumbers.length > 0 ? hotNumbers : [17, 32, 21, 3],
    coldNumbers: coldNumbers.length > 0 ? coldNumbers : [0, 26, 35, 11]
  });
};
app.get('/api/games/roulette/history', requireAuth, requirePlayerForGames, handleGetRouletteHistory);

// 4. POST Bets (Register bets for ongoing authoritative round)
const handlePostRouletteBets = async (req: Request, res: Response) => {
  const { bets, idempotencyKey }: { bets: RouletteBet[]; idempotencyKey?: string } = req.body;

  // Idempotency check to prevent double debit
  if (idempotencyKey && processedRouletteIdempotency.has(idempotencyKey)) {
    return res.json(processedRouletteIdempotency.get(idempotencyKey));
  }

  let totalBet = 0;
  try {
    totalBet = validateRouletteBets(bets);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid roulette bets' });
  }

  if (rouletteState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is currently closed for this round' });
  }

  let debitResult: any;
  try {
    debitResult = await debitRouletteBet({ debitForUser }, req, totalBet, `Roulette Bet #${rouletteState.roundId}`, idempotencyKey);
  } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const userId = req.user!.id;

  // The wallet debit is asynchronous. The round can close while that RPC is
  // in flight, so re-check the authoritative phase/deadline before persisting
  // any bet. A late debit is immediately refunded and never becomes a bet.
  const roundStillOpen =
    rouletteState.phase === 'betting' &&
    (!roulettePhaseEndsAt || Date.now() < roulettePhaseEndsAt);

  if (!roundStillOpen) {
    try {
      await supabaseRepo.atomicCredit(
        userId,
        totalBet,
        'refund',
        `Roulette late-bet refund #${rouletteState.roundId}`,
        'roulette',
        idempotencyKey ? `roulette:late-bet-refund:${idempotencyKey}` : undefined
      );
    } catch (refundError) {
      console.error('[RouletteBetTiming] late debit refund failed', {
        refundError, roundId: rouletteState.roundId, userId
      });
    }
    return res.status(409).json({ error: 'Betting closed before the bet was accepted' });
  }

  const placedAt = new Date().toISOString();
  const serverBets: ServerRouletteBet[] = bets.map((bet) => ({
    ...bet,
    userId,
    placedAt
  }));

  // Ensure the authoritative round exists in public.game_rounds before inserting
  // bets. The bets table has a foreign key to game_rounds(round_id).
  try {
    await supabaseRepo.recordGameRound(
      rouletteState.roundId,
      'roulette',
      rouletteState.phase,
      {
        roomId: rouletteState.roomId,
        startedAt: placedAt,
        countdown: rouletteState.countdown
      }
    );
  } catch (roundPersistError) {
    try {
      await supabaseRepo.atomicCredit(
        userId,
        totalBet,
        'refund',
        `Roulette round persistence refund #${rouletteState.roundId}`,
        'roulette',
        idempotencyKey ? `roulette:round-refund:${idempotencyKey}` : `roulette:round-refund:${rouletteState.roundId}:${userId}:${Date.now()}`
      );
    } catch (refundError) {
      console.error('[RouletteRoundPersistence] round persistence failed and refund failed', { roundPersistError, refundError, roundId: rouletteState.roundId, userId });
    }
    return res.status(503).json({ error: 'Roulette round could not be persisted. No bet was accepted.' });
  }

  // Persist the authoritative bet before the request completes so a process restart
  // cannot lose a debit that was already accepted.
  const persistedBetIds: string[] = [];
  try {
    for (const bet of serverBets) {
      const persisted = await supabaseRepo.recordGameBet({
        id: `roulette:${rouletteState.roundId}:${userId}:${crypto.randomUUID()}`,
        roundId: rouletteState.roundId,
        userId,
        gameId: 'roulette',
        betType: bet.type,
        betValue: { value: bet.value ?? null, numbers: bet.numbers ?? null },
        amount: Number(bet.amount),
        status: 'placed',
        idempotencyKey: idempotencyKey ? `${idempotencyKey}:${bet.type}:${bet.value ?? bet.numbers?.join(',') ?? 'na'}` : null
      });
      persistedBetIds.push(String(persisted.id));
    }
  } catch (persistError) {
    let cleanupError: unknown = null;
    try {
      await supabaseRepo.deleteGameBets(persistedBetIds);
    } catch (error) {
      cleanupError = error;
    }
    let refundError: unknown = null;
    try {
      await supabaseRepo.atomicCredit(
        userId,
        totalBet,
        'refund',
        `Roulette bet persistence refund #${rouletteState.roundId}`,
        'roulette',
        idempotencyKey ? `roulette:persist-refund:${idempotencyKey}` : `roulette:persist-refund:${rouletteState.roundId}:${userId}:${Date.now()}`
      );
    } catch (refundError) {
      console.error('[RouletteBetPersistence] persistence rollback/refund failed', { persistError, cleanupError, refundError, roundId: rouletteState.roundId, userId, persistedBetIds });
    }
    return res.status(503).json({ error: 'Roulette bet could not be persisted. No bet was accepted.' });
  }

  const existingBets = (currentRoundBets[rouletteState.roundId] || []) as ServerRouletteBet[];
  currentRoundBets[rouletteState.roundId] = [...existingBets, ...serverBets];

  const responsePayload = {
    success: true,
    roundId: rouletteState.roundId,
    bets: currentRoundBets[rouletteState.roundId].map(({ userId: _userId, placedAt: _placedAt, ...bet }) => bet),
    totalBetPlaced: totalBet,
    wallet: await supabaseRepo.getWallet(req.user!.id),
    countdown: rouletteState.countdown
  };

  if (idempotencyKey) {
    processedRouletteIdempotency.set(idempotencyKey, responsePayload);
  }

  emitRouletteEvent(broadcastRealtime, ROULETTE_SOCKET_EVENTS.walletUpdated, { wallet: await supabaseRepo.getWallet(req.user!.id) });
  return res.json(responsePayload);
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
    bets = ((currentRoundBets[roundId] || []) as ServerRouletteBet[])
      .filter((bet) => bet.userId === userId);
  }

  res.json({
    roundId,
    bets: bets.map(({ userId: _userId, placedAt: _placedAt, ...bet }) => bet),
    totalBet: bets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
  });
};
app.get('/api/games/roulette/bets', requireAuth, requirePlayerForGames, handleGetRouletteBets);

// 6. GET Settlement by roundId
const handleGetRouletteSettlement = (req: Request, res: Response) => {
  const roundId = req.params.roundId || rouletteState.roundId;
  const settlement = roundSettlements[roundId];
  const userId = req.user!.id;

  if (!settlement) {
    return res.status(404).json({ error: `Settlement not found for round ${roundId}` });
  }

  // Never expose the full playerSettlements map. It contains per-user wager and
  // payout information and is not a public game-state field.
  const playerSettlement = settlement.playerSettlements?.[userId];
  return res.json({
    settlement: {
      roundId,
      winningNumber: settlement.winningNumber,
      winningColor: settlement.winningColor,
      winningCategory: settlement.winningCategory,
      settlementStatus: settlement.settlementStatus,
      totalBet: playerSettlement?.totalBet ?? 0,
      grossPayout: playerSettlement?.grossPayout ?? 0,
      netResult: playerSettlement?.netResult ?? 0,
      isWin: (playerSettlement?.grossPayout ?? 0) > 0
    }
  });
};
app.get('/api/games/roulette/settlement/:roundId', requireAuth, requirePlayerForGames, handleGetRouletteSettlement);

// 7. GET the authenticated player's settlement only.
// This is a recovery path when a WebSocket player-result event is missed.
const handleGetMyRouletteSettlement = (req: Request, res: Response) => {
  const roundId = req.params.roundId;
  const settlement = roundSettlements[roundId];
  const userId = req.user!.id;
  const playerSettlement = settlement?.playerSettlements?.[userId];
  if (!playerSettlement) {
    return res.status(404).json({ error: 'Player settlement not found for this round' });
  }
  return res.json({
    settlement: {
      roundId,
      winningNumber: settlement.winningNumber,
      winningColor: settlement.winningColor,
      winningCategory: settlement.winningCategory,
      totalBet: playerSettlement.totalBet,
      grossPayout: playerSettlement.grossPayout,
      netResult: playerSettlement.netResult,
      isWin: playerSettlement.grossPayout > 0,
      settlementStatus: settlement.settlementStatus
    }
  });
};
app.get('/api/games/roulette/my-settlement/:roundId', requireAuth, requirePlayerForGames, handleGetMyRouletteSettlement);

// 7. POST Spin (Instant spin & authoritative settlement flow)
const handlePostRouletteSpin = async (req: Request, res: Response) => {
  // Roulette is now fully server-cycle authoritative, like Aviator.
  // /spin remains as a compatibility endpoint for older clients, but it never
  // generates an outcome or settles a round directly.
  if (rouletteState.phase !== 'betting') {
    return res.status(409).json({ error: 'Betting is closed for this round', roundId: rouletteState.roundId, phase: rouletteState.phase, countdown: rouletteState.countdown });
  }
  return handlePostRouletteBets(req, res);
};
app.post('/api/games/roulette/spin', requireAuth, requirePlayerForGames, handlePostRouletteSpin);


// -------------------------------------------------------------

}
