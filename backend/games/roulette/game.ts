import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Card, RouletteBet, RouletteState, TeenPattiPlayer, TeenPattiState, AviatorBet, AviatorState, DiceState, DragonTigerState, DragonTigerBetSide, AndarBaharState, AndarBaharSide, GameHistoryEntry, User, Wallet, Transaction } from '../../types.ts';

/** Server-authoritative roulette module. All shared infrastructure is injected by the thin router. */
const GAME_ROOM_ID = 'roulette-main';

export function registerRouletteGame(app: any, deps: any) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService, recordHistory, broadcastRealtime, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, debitForUser, creditForUser, getRequestUser, generateDeck, secureShuffleDeck, evaluateTeenPattiHand, compareHands, computePlayerSettlement, createAuthoritativeTeenPattiRound, sanitizeTeenPattiState } = deps;

// -------------------------------------------------------------
// Exact European Roulette wheel sequence (37 pockets, single 0)
const EUROPEAN_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

const ROULETTE_LIMITS = {
  minimumBet: 10,
  maximumBet: 50000,
  maximumExposure: 500000
};

const DEFAULT_ROULETTE_CLIENT_SEED = 'roulette-client-v1';

type ServerRouletteBet = RouletteBet & { userId: string; placedAt: string };

function createRouletteFairRound() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return { serverSeed, serverSeedHash, clientSeed: DEFAULT_ROULETTE_CLIENT_SEED, nonce: crypto.randomBytes(16).toString('hex') };
}

function deriveRouletteOutcome(serverSeed: string, clientSeed: string, nonce: string) {
  const digest = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest();
  return EUROPEAN_WHEEL[digest.readUInt32BE(0) % EUROPEAN_WHEEL.length];
}

function verifyRouletteFairResult(serverSeed: string, serverSeedHash: string, clientSeed: string, nonce: string, winningNumber: number) {
  const computedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  const derivedNumber = deriveRouletteOutcome(serverSeed, clientSeed, nonce);
  return computedHash === serverSeedHash && derivedNumber === winningNumber;
}

const ROULETTE_PAYOUT_RULES = {
  straight: { ratio: '35:1', multiplier: 36, description: 'Straight Up: Single number 0-36 (35:1 profit, 36x gross)' },
  split: { ratio: '17:1', multiplier: 18, description: 'Split: Two adjacent numbers (17:1 profit, 18x gross)' },
  street: { ratio: '11:1', multiplier: 12, description: 'Street: Three numbers in a row (11:1 profit, 12x gross)' },
  corner: { ratio: '8:1', multiplier: 9, description: 'Corner: Four adjacent numbers (8:1 profit, 9x gross)' },
  sixline: { ratio: '5:1', multiplier: 6, description: 'Six Line: Six numbers across two rows (5:1 profit, 6x gross)' },
  dozen: { ratio: '2:1', multiplier: 3, description: 'Dozen: 1-12, 13-24, or 25-36 (2:1 profit, 3x gross)' },
  column: { ratio: '2:1', multiplier: 3, description: 'Column: 1st, 2nd, or 3rd column of 12 (2:1 profit, 3x gross)' },
  red_black: { ratio: '1:1', multiplier: 2, description: 'Red / Black: Even money (1:1 profit, 2x gross, 0 loses)' },
  even_odd: { ratio: '1:1', multiplier: 2, description: 'Even / Odd: Even money (1:1 profit, 2x gross, 0 loses)' },
  low_high: { ratio: '1:1', multiplier: 2, description: 'Low / High: 1-18 or 19-36 (1:1 profit, 2x gross, 0 loses)' }
};

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

// Memory stores for Roulette
const currentRoundBets: Record<string, ServerRouletteBet[]> = {};
const roundSettlements: Record<string, any> = {};
const processedRouletteIdempotency = new Map<string, any>();

function serializeRoulettePersistence() {
  return {
    ...rouletteState,
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

// Authoritative settlement engine for European Roulette
function computeRouletteSettlement(winningNum: number, bets: RouletteBet[]) {
  const isRed = RED_NUMBERS.includes(winningNum);
  const isZero = winningNum === 0;
  const winningColor: 'red' | 'black' | 'green' = isZero ? 'green' : isRed ? 'red' : 'black';

  const categories: string[] = [];
  if (isZero) {
    categories.push('0 GREEN (Zero Pocket)');
  } else {
    categories.push(`${winningNum} ${winningColor.toUpperCase()}`);
    categories.push(winningNum % 2 === 0 ? 'Even' : 'Odd');
    categories.push(winningNum <= 18 ? 'Low (1-18)' : 'High (19-36)');
    if (winningNum <= 12) categories.push('1st Dozen (1-12)');
    else if (winningNum <= 24) categories.push('2nd Dozen (13-24)');
    else categories.push('3rd Dozen (25-36)');

    if (winningNum % 3 === 1) categories.push('1st Col');
    else if (winningNum % 3 === 2) categories.push('2nd Col');
    else categories.push('3rd Col');
  }
  const winningCategory = categories.join(' • ');

  let totalBet = 0;
  let grossPayout = 0;
  const winningBets: any[] = [];
  const losingBets: any[] = [];

  for (const bet of bets) {
    const amt = Number(bet.amount || 0);
    totalBet += amt;
    let isWin = false;
    let multiplier = 0; // gross multiplier = (payout ratio profit) + 1

    switch (bet.type) {
      case 'straight':
      case 'number': {
        const target = bet.value !== undefined ? bet.value : (bet.numbers?.[0] ?? -1);
        if (target === winningNum) {
          isWin = true;
          multiplier = 36; // 35:1 profit + 1x stake
        }
        break;
      }
      case 'split': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 18; // 17:1 profit + 1x stake
        }
        break;
      }
      case 'street': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 12; // 11:1 profit + 1x stake
        }
        break;
      }
      case 'corner': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 9; // 8:1 profit + 1x stake
        }
        break;
      }
      case 'sixline': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 6; // 5:1 profit + 1x stake
        }
        break;
      }
      // OUTSIDE BETS (Zero Rule: All outside bets lose when winningNum === 0)
      case 'dozen1': {
        if (!isZero && winningNum >= 1 && winningNum <= 12) {
          isWin = true;
          multiplier = 3; // 2:1 profit + 1x stake
        }
        break;
      }
      case 'dozen2': {
        if (!isZero && winningNum >= 13 && winningNum <= 24) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'dozen3': {
        if (!isZero && winningNum >= 25 && winningNum <= 36) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col1': {
        if (!isZero && winningNum % 3 === 1) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col2': {
        if (!isZero && winningNum % 3 === 2) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col3': {
        if (!isZero && winningNum % 3 === 0) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'red': {
        if (!isZero && isRed) {
          isWin = true;
          multiplier = 2; // 1:1 profit + 1x stake
        }
        break;
      }
      case 'black': {
        if (!isZero && !isRed) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'even': {
        if (!isZero && winningNum % 2 === 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'odd': {
        if (!isZero && winningNum % 2 !== 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'low': {
        if (!isZero && winningNum >= 1 && winningNum <= 18) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'high': {
        if (!isZero && winningNum >= 19 && winningNum <= 36) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
    }

    const payoutAmount = isWin ? amt * multiplier : 0;
    const profit = isWin ? payoutAmount - amt : -amt;

    const resultItem = {
      bet,
      isWin,
      payoutMultiplier: multiplier,
      payoutAmount,
      profit
    };

    if (isWin) {
      grossPayout += payoutAmount;
      winningBets.push(resultItem);
    } else {
      losingBets.push(resultItem);
    }
  }

  const netResult = grossPayout - totalBet;

  return {
    winningColor,
    winningCategory,
    winningBets,
    losingBets,
    totalBet,
    grossPayout,
    netResult
  };
}

// Restore the single shared roulette room before starting the authoritative clock.
// A browser refresh must never create/reset a round; the persisted server state is the source of truth.
let rouletteRoomReady = false;
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
let roulettePhaseEndsAt = Date.now() + Math.max(1, Number(rouletteState.countdown || 15)) * 1000;

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

      // Authoritative RNG generation strictly on server before spin starts
      const winningNum = deriveRouletteOutcome(rouletteFairRound.serverSeed, rouletteFairRound.clientSeed, rouletteFairRound.nonce);
      rouletteState.winningNumber = winningNum;
      rouletteState.winningColor = winningNum === 0 ? 'green' : RED_NUMBERS.includes(winningNum) ? 'red' : 'black';

      // Start the wheel immediately at the authoritative deadline. DB persistence
      // runs in the background and must not add visible latency.
      broadcastRealtime('roulette_spin_started', {
        roundId: rouletteState.roundId,
        winningNumber: winningNum,
        winningColor: rouletteState.winningColor,
        countdown: 5,
        endsAt: roulettePhaseEndsAt
      });
      void supabaseRepo.recordGameRound(
        rouletteState.roundId,
        'roulette',
        'spinning',
        { roomId: GAME_ROOM_ID, countdown: 5, winningNumber: winningNum, winningColor: rouletteState.winningColor },
        Date.now()
      ).catch((error: unknown) => console.error('[Roulette] failed to persist spinning phase', error));
    }
  } else if (rouletteState.phase === 'spinning') {
    rouletteState.countdown = Math.max(0, Math.ceil((roulettePhaseEndsAt - Date.now()) / 1000));
    if (rouletteState.countdown <= 0) {
      rouletteState.phase = 'result';
      rouletteState.countdown = 4;
      roulettePhaseEndsAt = Date.now() + 4000;

      const currentRoundId = rouletteState.roundId;
      const winningNum = rouletteState.winningNumber ?? 0;
      // Result phase is also visible immediately; settlement/persistence follows.
      broadcastRealtime('roulette_result', {
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
        broadcastRealtime('roulette_player_result', {
          userId,
          roundId: currentRoundId,
          winningNumber: winningNum,
          totalBet: playerSettlement.totalBet,
          grossPayout: playerSettlement.grossPayout,
          netResult: playerSettlement.netResult,
          isWin: playerSettlement.grossPayout > 0,
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
            broadcastRealtime('roulette_wallet_updated', {
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
            details: { winningNumber: winningNum, winningColor: settlement.winningColor }
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

      broadcastRealtime('roulette_result', {
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
      broadcastRealtime('roulette_settlement', roundSettlements[rouletteState.roundId]);
      broadcastRealtime('roulette_wallet_updated', { gameId: 'roulette' });
    }
  } else if (rouletteState.phase === 'result') {
    rouletteState.countdown -= 1;
    if (rouletteState.countdown <= 0) {
      // Transition to new round
      const newRoundId = 'RL-' + crypto.randomInt(1000, 10000);
      rouletteState.roundId = newRoundId;
      rouletteState.phase = 'betting';
      rouletteState.countdown = 15;
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

      broadcastRealtime('roulette_round_started', {
        roundId: newRoundId,
        countdown: 15
      });
      broadcastRealtime('roulette_betting_open', {
        roundId: newRoundId,
        countdown: 15
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
  res.json({
    state: rouletteState,
    roundId: rouletteState.roundId,
    phase: rouletteState.phase,
    countdown: rouletteState.countdown,
    endsAt: roulettePhaseEndsAt,
    winningNumber: rouletteState.winningNumber,
    winningColor: rouletteState.winningColor,
    winningCategory: rouletteState.winningCategory,
    recentResults: rouletteState.recentResults,
    serverSeedHash: rouletteState.serverSeedHash,
    limits: ROULETTE_LIMITS
  });
};
app.get('/api/games/roulette/round', requireAuth, requirePlayerForGames, handleGetRouletteRound);
app.get('/api/games/roulette/state', requireAuth, requirePlayerForGames, handleGetRouletteRound);

app.get('/api/games/roulette/fairness/:roundId', requireAuth, requirePlayerForGames, (req: Request, res: Response) => {
  const roundId = req.params.roundId;
  const settlement = roundSettlements[roundId];
  if (!settlement?.provablyFair) return res.status(404).json({ error: 'Fairness proof is available after settlement' });
  const proof = settlement.provablyFair;
  return res.json({ roundId, ...proof, verified: verifyRouletteFairResult(proof.serverSeed, proof.serverSeedHash, proof.clientSeed, proof.nonce, proof.winningNumber) });
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

  if (!bets || !Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ error: 'At least one bet is required' });
  }

  // Validate bets against server limits
  let totalBet = 0;
  for (const b of bets) {
    const amt = Number(b.amount || 0);
    if (isNaN(amt) || amt < ROULETTE_LIMITS.minimumBet) {
      return res.status(400).json({ error: `Minimum bet is ₹${ROULETTE_LIMITS.minimumBet}` });
    }
    if (amt > ROULETTE_LIMITS.maximumBet) {
      return res.status(400).json({ error: `Maximum bet per spot is ₹${ROULETTE_LIMITS.maximumBet}` });
    }
    totalBet += amt;
  }

  if (totalBet > ROULETTE_LIMITS.maximumExposure) {
    return res.status(400).json({ error: `Maximum total exposure is ₹${ROULETTE_LIMITS.maximumExposure}` });
  }

  if (rouletteState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is currently closed for this round' });
  }

  let debitResult: any;
  try {
    debitResult = await debitForUser(req, totalBet, `Roulette Bet #${rouletteState.roundId}`, 'roulette', idempotencyKey);
  } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const userId = req.user!.id;
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
  try {
    for (const bet of serverBets) {
      await supabaseRepo.recordGameBet({
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
    }
  } catch (persistError) {
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
      console.error('[RouletteBetPersistence] debit accepted but persistence failed and refund failed', { persistError, refundError, roundId: rouletteState.roundId, userId });
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

  broadcastRealtime('roulette_wallet_updated', { wallet: await supabaseRepo.getWallet(req.user!.id) });
  return res.json(responsePayload);
};
app.post('/api/games/roulette/bets', requireAuth, requirePlayerForGames, handlePostRouletteBets);

// 5. GET Active Bets
const handleGetRouletteBets = (_req: Request, res: Response) => {
  const bets = currentRoundBets[rouletteState.roundId] || [];
  res.json({
    roundId: rouletteState.roundId,
    bets,
    totalBet: bets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
  });
};
app.get('/api/games/roulette/bets', requireAuth, requirePlayerForGames, handleGetRouletteBets);

// 6. GET Settlement by roundId
const handleGetRouletteSettlement = (req: Request, res: Response) => {
  const roundId = req.params.roundId || rouletteState.roundId;
  const settlement = roundSettlements[roundId];
  if (!settlement) {
    return res.status(404).json({ error: `Settlement not found for round ${roundId}` });
  }
  return res.json({ settlement });
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
  const { bets, idempotencyKey }: { bets: RouletteBet[]; idempotencyKey?: string } = req.body;

  // Idempotency check
  if (idempotencyKey && processedRouletteIdempotency.has(idempotencyKey)) {
    return res.json(processedRouletteIdempotency.get(idempotencyKey));
  }

  if (!bets || !Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ error: 'At least one bet is required' });
  }

  let totalBet = 0;
  for (const b of bets) {
    const amt = Number(b.amount || 0);
    if (isNaN(amt) || amt < ROULETTE_LIMITS.minimumBet) {
      return res.status(400).json({ error: `Minimum bet is ₹${ROULETTE_LIMITS.minimumBet}` });
    }
    if (amt > ROULETTE_LIMITS.maximumBet) {
      return res.status(400).json({ error: `Maximum bet per spot is ₹${ROULETTE_LIMITS.maximumBet}` });
    }
    totalBet += amt;
  }

  if (totalBet > ROULETTE_LIMITS.maximumExposure) {
    return res.status(400).json({ error: `Maximum total exposure is ₹${ROULETTE_LIMITS.maximumExposure}` });
  }

  // Atomic debit
  const currentRoundId = rouletteState.roundId;
  const fairRoundForSpin = rouletteFairRound;
  try { await debitForUser(req, totalBet, `Roulette Round ${currentRoundId}`, 'roulette', idempotencyKey); } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Authoritative server outcome from European wheel (0-36)
  const winningNum = deriveRouletteOutcome(rouletteFairRound.serverSeed, rouletteFairRound.clientSeed, rouletteFairRound.nonce);
  const settlement = computeRouletteSettlement(winningNum, bets);

  // Atomic credit if winning
  if (settlement.grossPayout > 0) {
    await creditForUser(req, settlement.grossPayout, `Roulette Payout #${currentRoundId}`, 'roulette');
  }

  // Update server state
  rouletteState.winningNumber = winningNum;
  rouletteState.winningColor = settlement.winningColor;
  rouletteState.winningCategory = settlement.winningCategory;
  rouletteState.recentResults.unshift(winningNum);
  if (rouletteState.recentResults.length > 20) rouletteState.recentResults.pop();

  rouletteHistoryRecords.unshift({
    roundId: currentRoundId,
    number: winningNum,
    color: settlement.winningColor,
    timestamp: new Date().toISOString()
  });
  if (rouletteHistoryRecords.length > 50) rouletteHistoryRecords.pop();

  recordHistory({
    gameId: 'roulette',
    gameName: 'Roulette',
    betAmount: totalBet,
    winAmount: settlement.grossPayout,
    outcome: `Landed on ${winningNum} ${settlement.winningColor.toUpperCase()}`,
    multiplier: totalBet > 0 ? Number((settlement.grossPayout / totalBet).toFixed(2)) : 0,
    settlementStatus: 'settled'
  });

  const nextRoundId = 'RL-' + crypto.randomInt(1000, 10000);
  rouletteState.roundId = nextRoundId;
  rouletteFairRound = createRouletteFairRound();
      rouletteState.serverSeedHash = rouletteFairRound.serverSeedHash;

  const fullSettlementResult = {
    success: true,
    roundId: currentRoundId,
    nextRoundId,
    winningNumber: winningNum,
    winningColor: settlement.winningColor,
    winningCategory: settlement.winningCategory,
    winningBets: settlement.winningBets,
    losingBets: settlement.losingBets,
    totalBet,
    winAmount: settlement.grossPayout,
    grossPayout: settlement.grossPayout,
    netProfit: settlement.netResult,
    netResult: settlement.netResult,
    settlementStatus: 'settled',
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentResults: rouletteState.recentResults,
    provablyFair: undefined as {
      serverSeedHash: string;
      serverSeed: string;
      clientSeed: string;
      nonce: string;
      winningNumber: number;
    } | undefined
  };

  fullSettlementResult.provablyFair = {
    serverSeedHash: fairRoundForSpin.serverSeedHash,
    serverSeed: fairRoundForSpin.serverSeed,
    clientSeed: fairRoundForSpin.clientSeed,
    nonce: fairRoundForSpin.nonce,
    winningNumber: winningNum
  };
  roundSettlements[currentRoundId] = fullSettlementResult;

  if (idempotencyKey) {
    processedRouletteIdempotency.set(idempotencyKey, fullSettlementResult);
  }

  broadcastRealtime('roulette_spin_started', { roundId: currentRoundId, winningNumber: winningNum, winningColor: settlement.winningColor, countdown: 5 });
  broadcastRealtime('roulette_result', { roundId: currentRoundId, winningNumber: winningNum, winningColor: settlement.winningColor, category: settlement.winningCategory });
  broadcastRealtime('roulette_settlement', fullSettlementResult);
  broadcastRealtime('roulette_wallet_updated', { wallet: await supabaseRepo.getWallet(req.user!.id) });

  return res.json(fullSettlementResult);
};
app.post('/api/games/roulette/spin', requireAuth, requirePlayerForGames, handlePostRouletteSpin);


// -------------------------------------------------------------

}
