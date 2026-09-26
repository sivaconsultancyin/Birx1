import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Card, RouletteBet, RouletteState, TeenPattiPlayer, TeenPattiState, AviatorBet, AviatorState, DiceState, DragonTigerState, DragonTigerBetSide, AndarBaharState, AndarBaharSide, GameHistoryEntry, User, Wallet, Transaction } from '../../types.ts';

/** Server-authoritative dragon-tiger module. All shared infrastructure is injected by the thin router. */
export function registerDragonTigerGame(app: any, deps: any) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService, recordHistory, broadcastSSE, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, debitForUser, creditForUser, getRequestUser, generateDeck, secureShuffleDeck, evaluateTeenPattiHand, compareHands, computePlayerSettlement, createAuthoritativeTeenPattiRound, sanitizeTeenPattiState } = deps;

// -------------------------------------------------------------
let dragonTigerState: DragonTigerState = {
  roundId: 'DT-' + crypto.randomInt(1000, 10000),
  phase: 'betting',
  dragonCard: { suit: 'hearts', rank: 'K', value: 13 },
  tigerCard: { suit: 'spades', rank: '7', value: 7 },
  winner: 'dragon',
  recentResults: ['dragon', 'tiger', 'dragon', 'tie', 'tiger', 'dragon', 'dragon'],
  countdown: 10
};

app.get('/api/games/dragon-tiger/state', requireAuth, requirePlayerForGames, (_req: Request, res: Response) => {
  res.json({ state: dragonTigerState });
});

app.post('/api/games/dragon-tiger/deal', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const { betSide, amount }: { betSide: DragonTigerBetSide; amount: number } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  try { await debitForUser(req, numAmount, `Dragon Tiger: ${betSide.toUpperCase()}`, 'dragon-tiger'); } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const deck = generateDeck();
  const dragonCard = deck.pop()!;
  const tigerCard = deck.pop()!;

  let winner: DragonTigerBetSide = 'tie';
  if (dragonCard.value > tigerCard.value) winner = 'dragon';
  else if (tigerCard.value > dragonCard.value) winner = 'tiger';

  let multiplier = 0;
  if (betSide === winner) {
    multiplier = winner === 'tie' ? 9.0 : 2.0; // 8:1 payout for tie, 1:1 for side
  } else if (winner === 'tie' && (betSide === 'dragon' || betSide === 'tiger')) {
    multiplier = 0.5; // push half return on tie
  }

  const winAmount = Math.floor(numAmount * multiplier);
  if (winAmount > 0) {
    await creditForUser(req, winAmount, `Dragon Tiger Win (${winner.toUpperCase()})`, 'dragon-tiger');
  }

  dragonTigerState.dragonCard = dragonCard;
  dragonTigerState.tigerCard = tigerCard;
  dragonTigerState.winner = winner;
  dragonTigerState.recentResults.unshift(winner);
  if (dragonTigerState.recentResults.length > 15) dragonTigerState.recentResults.pop();
  dragonTigerState.roundId = 'DT-' + crypto.randomInt(1000, 10000);

  broadcastSSE('dragon_tiger_result', {
    gameId: 'dragon-tiger',
    roundId: dragonTigerState.roundId,
    dragonCard,
    tigerCard,
    winner,
    multiplier,
    winAmount,
    recentResults: dragonTigerState.recentResults
  });

  recordHistory({
    gameId: 'dragon-tiger',
    gameName: 'Dragon Tiger',
    betAmount: numAmount,
    winAmount,
    outcome: `${winner.toUpperCase()} Won (D: ${dragonCard.rank}, T: ${tigerCard.rank})`,
    multiplier,
    settlementStatus: 'settled'
  });

  return res.json({
    success: true,
    dragonCard,
    tigerCard,
    winner,
    multiplier,
    winAmount,
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentResults: dragonTigerState.recentResults
  });
});

// -------------------------------------------------------------

}
