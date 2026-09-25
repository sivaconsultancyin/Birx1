import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Card, RouletteBet, RouletteState, TeenPattiPlayer, TeenPattiState, AviatorBet, AviatorState, DiceState, DragonTigerState, DragonTigerBetSide, AndarBaharState, AndarBaharSide, GameHistoryEntry, User, Wallet, Transaction } from '../../../src/types.ts';

/** Server-authoritative andar-bahar module. All shared infrastructure is injected by the thin router. */
export function registerAndarBaharGame(app: any, deps: any) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService, recordHistory, broadcastSSE, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, debitForUser, creditForUser, getRequestUser, generateDeck, secureShuffleDeck, evaluateTeenPattiHand, compareHands, computePlayerSettlement, createAuthoritativeTeenPattiRound, sanitizeTeenPattiState } = deps;

// -------------------------------------------------------------
const andarBaharBets = new Map<string, { side: AndarBaharSide; amount: number }>();
let andarBaharDealtQueue: { side: AndarBaharSide; card: Card }[] = [];
let andarBaharTargetJoker: Card | null = { suit: 'spades', rank: '8', value: 8 };
let andarBaharFinalWinner: AndarBaharSide = 'andar';

let andarBaharState: AndarBaharState = {
  roundId: 'AB-' + crypto.randomInt(1000, 10000),
  phase: 'betting',
  jokerCard: { suit: 'spades', rank: '8', value: 8 },
  dealtCards: [
    { side: 'andar', card: { suit: 'hearts', rank: '3', value: 3 } },
    { side: 'bahar', card: { suit: 'clubs', rank: 'K', value: 13 } },
    { side: 'andar', card: { suit: 'diamonds', rank: '8', value: 8 } }
  ],
  winningSide: 'andar',
  recentWinners: ['andar', 'bahar', 'andar', 'andar', 'bahar'],
  countdown: 10,
  startedAt: Date.now(),
  phaseEndsAt: Date.now() + 10000
};

// Start a fresh server-authoritative Andar Bahar round
function startAuthoritativeAndarBaharRound() {
  const deck = generateDeck();
  const joker = deck.pop()!;
  const dealt: { side: AndarBaharSide; card: Card }[] = [];
  let currentSide: AndarBaharSide = 'andar';
  let winner: AndarBaharSide = 'andar';

  while (deck.length > 0) {
    const card = deck.pop()!;
    dealt.push({ side: currentSide, card });
    if (card.rank === joker.rank) {
      winner = currentSide;
      break;
    }
    currentSide = currentSide === 'andar' ? 'bahar' : 'andar';
  }

  andarBaharTargetJoker = joker;
  andarBaharDealtQueue = dealt;
  andarBaharFinalWinner = winner;

  andarBaharState.roundId = 'AB-' + crypto.randomInt(1000, 10000);
  andarBaharState.phase = 'betting';
  andarBaharState.countdown = 10;
  andarBaharState.jokerCard = null;
  andarBaharState.dealtCards = [];
  andarBaharState.winningSide = null;
  andarBaharState.phaseEndsAt = Date.now() + 10000;
  andarBaharState.startedAt = Date.now();
  andarBaharState.userBet = undefined;
  andarBaharState.userSettlement = undefined;

  broadcastSSE('andar_bahar_state_update', { state: andarBaharState });
}

// Background Authoritative Andar Bahar Round Cycle
setInterval(async () => {
  if (andarBaharState.phase === 'betting') {
    andarBaharState.countdown -= 1;
    if (andarBaharState.countdown <= 0) {
      // Transition to Dealer Shuffle Phase (Elena & Marcus shuffle)
      andarBaharState.phase = 'shuffle';
      andarBaharState.countdown = 3;
      andarBaharState.phaseEndsAt = Date.now() + 3000;
      broadcastSSE('andar_bahar_shuffling', {
        roundId: andarBaharState.roundId,
        phase: 'shuffle',
        duration: 3000
      });
      broadcastSSE('andar_bahar_state_update', { state: andarBaharState });
    }
  } else if (andarBaharState.phase === 'shuffle') {
    andarBaharState.countdown -= 1;
    if (andarBaharState.countdown <= 0) {
      // Transition to Dealing Phase: Deal Joker first, then cards sequentially
      andarBaharState.phase = 'dealing';
      andarBaharState.jokerCard = andarBaharTargetJoker;
      andarBaharState.dealtCards = [...andarBaharDealtQueue];
      andarBaharState.winningSide = andarBaharFinalWinner;
      andarBaharState.countdown = Math.max(3, Math.min(8, andarBaharDealtQueue.length));
      andarBaharState.phaseEndsAt = Date.now() + andarBaharState.countdown * 1000;

      broadcastSSE('andar_bahar_dealing', {
        roundId: andarBaharState.roundId,
        phase: 'dealing',
        jokerCard: andarBaharTargetJoker,
        dealtCards: andarBaharDealtQueue,
        winningSide: andarBaharFinalWinner
      });
      broadcastSSE('andar_bahar_state_update', { state: andarBaharState });
    }
  } else if (andarBaharState.phase === 'dealing') {
    andarBaharState.countdown -= 1;
    if (andarBaharState.countdown <= 0) {
      // Settle Round & Payouts
      andarBaharState.phase = 'settled';
      andarBaharState.countdown = 4;
      andarBaharState.phaseEndsAt = Date.now() + 4000;

      andarBaharState.recentWinners.unshift(andarBaharFinalWinner);
      if (andarBaharState.recentWinners.length > 15) andarBaharState.recentWinners.pop();

      // Check if user had an active bet for this round
      for (const [userId, activeAndarBaharBet] of andarBaharBets) {
        const numAmount = activeAndarBaharBet.amount;
        const betSide = activeAndarBaharBet.side;
        const isWin = betSide === andarBaharFinalWinner;
        const multiplier = isWin ? (andarBaharFinalWinner === 'andar' ? 1.9 : 2.0) : 0;
        const winAmount = Math.floor(numAmount * multiplier);

        if (winAmount > 0) {
          await supabaseRepo.atomicCredit(userId, winAmount, 'payout', `Andar Bahar Win on ${andarBaharFinalWinner.toUpperCase()}`, 'andar-bahar', `andar-bahar:${andarBaharState.roundId}:${userId}`);
        }

        recordHistory({
          gameId: 'andar-bahar',
          gameName: 'Andar Bahar',
          betAmount: numAmount,
          winAmount,
          outcome: `${andarBaharFinalWinner.toUpperCase()} matched Joker ${andarBaharTargetJoker?.rank} after ${andarBaharDealtQueue.length} cards`,
          multiplier,
          settlementStatus: 'settled'
        });

        andarBaharState.userSettlement = {
          isWin,
          winAmount,
          betAmount: numAmount,
          side: betSide,
          multiplier
        };

        andarBaharBets.delete(userId);
      }

      broadcastSSE('andar_bahar_settled', {
        roundId: andarBaharState.roundId,
        phase: 'settled',
        winner: andarBaharFinalWinner,
        recentWinners: andarBaharState.recentWinners
      });
      broadcastSSE('andar_bahar_state_update', { state: andarBaharState });
    }
  } else if (andarBaharState.phase === 'settled') {
    andarBaharState.countdown -= 1;
    if (andarBaharState.countdown <= 0) {
      startAuthoritativeAndarBaharRound();
    }
  }
}, 1000);

app.get('/api/games/andar-bahar/state', requireAuth, requirePlayerForGames, (req: Request, res: Response) => {
  res.json({ state: { ...andarBaharState, userBet: andarBaharBets.get(req.user!.id) ?? undefined } });
});

app.post('/api/games/andar-bahar/deal', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const { betSide, amount }: { betSide: AndarBaharSide; amount: number } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  try { await debitForUser(req, numAmount, `Andar Bahar: ${betSide.toUpperCase()}`, 'andar-bahar'); } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Register bet on active server-authoritative round
  const activeAndarBaharBet = { side: betSide, amount: numAmount };
  andarBaharBets.set(req.user!.id, activeAndarBaharBet);

  // If currently in betting phase, immediately trigger shuffle/deal if under 2s or accelerate
  if (andarBaharState.phase === 'betting' && andarBaharState.countdown > 3) {
    andarBaharState.countdown = 2; // quick countdown transition
  }

  // Also ensure authoritative outcome is provided
  const isWin = betSide === andarBaharFinalWinner;
  const multiplier = isWin ? (andarBaharFinalWinner === 'andar' ? 1.9 : 2.0) : 0;
  const winAmount = Math.floor(numAmount * multiplier);

  broadcastSSE('andar_bahar_state_update', { state: andarBaharState });

  return res.json({
    success: true,
    roundId: andarBaharState.roundId,
    jokerCard: andarBaharTargetJoker,
    dealtCards: andarBaharDealtQueue,
    winningSide: andarBaharFinalWinner,
    multiplier,
    winAmount,
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentWinners: andarBaharState.recentWinners,
    state: andarBaharState
  });
});

// -------------------------------------------------------------

}
