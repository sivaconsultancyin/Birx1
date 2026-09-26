import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Card, RouletteBet, RouletteState, TeenPattiPlayer, TeenPattiState, AviatorBet, AviatorState, DiceState, DragonTigerState, DragonTigerBetSide, AndarBaharState, AndarBaharSide, GameHistoryEntry, User, Wallet, Transaction } from '../../types.ts';

/** Server-authoritative teen-patti module. All shared infrastructure is injected by the thin router. */
export function registerTeenPattiGame(app: any, deps: any) {
  const { supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService, recordHistory, broadcastSSE, acquireGameLease, safeSaveAuthoritativeGameState, safeGetAuthoritativeGameState, debitForUser, creditForUser, getRequestUser, generateDeck, secureShuffleDeck, evaluateTeenPattiHand, compareHands, computePlayerSettlement, createAuthoritativeTeenPattiRound, sanitizeTeenPattiState } = deps;

// -------------------------------------------------------------
let teenPattiState: TeenPattiState = createAuthoritativeTeenPattiRound('Player', undefined, 50);

// Background Authoritative Teen Patti Round Cycle
setInterval(async () => {
  if (!(await acquireGameLease('teen-patti'))) return;
  const persistedTeen = await safeGetAuthoritativeGameState('teen-patti');
  if (persistedTeen) teenPattiState = persistedTeen as TeenPattiState;
  if (teenPattiState.phase === 'betting') {
    teenPattiState.countdown -= 1;
    if (teenPattiState.countdown <= 0) {
      teenPattiState.phase = 'lock';
      teenPattiState.countdown = 1;
      teenPattiState.phaseEndsAt = Date.now() + 1000;
      broadcastSSE('teen_patti_betting_closed', {
        roundId: teenPattiState.roundId,
        phase: 'lock'
      });
    }
  } else if (teenPattiState.phase === 'lock') {
    teenPattiState.countdown -= 1;
    if (teenPattiState.countdown <= 0) {
      teenPattiState.phase = 'deal';
      teenPattiState.countdown = 5;
      teenPattiState.phaseEndsAt = Date.now() + 5000;
      broadcastSSE('teen_patti_dealing_started', {
        roundId: teenPattiState.roundId,
        phase: 'deal',
        duration: 5000
      });
    }
  } else if (teenPattiState.phase === 'deal') {
    teenPattiState.countdown -= 1;
    if (teenPattiState.countdown <= 0) {
      teenPattiState.phase = 'compare';
      teenPattiState.countdown = 2;
      teenPattiState.dealerRevealed = true;
      if (teenPattiState.dealer) {
        teenPattiState.dealer.revealed = true;
      }
      teenPattiState.phaseEndsAt = Date.now() + 2000;
      broadcastSSE('teen_patti_dealer_revealed', {
        roundId: teenPattiState.roundId,
        phase: 'compare',
        dealer: teenPattiState.dealer
      });
    }
  } else if (teenPattiState.phase === 'compare') {
    teenPattiState.countdown -= 1;
    if (teenPattiState.countdown <= 0) {
      teenPattiState.phase = 'settlement';

      const userPlayer = teenPattiState.players.find((p) => p.isUser);
      let userSettlementDetail = undefined;
      if (userPlayer && teenPattiState.dealer) {
        const settlement = computePlayerSettlement(
          userPlayer.currentBet,
          userPlayer.cards,
          teenPattiState.dealer.cards,
          userPlayer.id,
          true
        );
        userSettlementDetail = settlement;
        teenPattiState.userSettlement = settlement;

        if (settlement.grossPayout > 0) {
          // Wallet settlement is request-scoped; shared background state cannot safely identify a user.
        }

        if (settlement.betAmount > 0) {
          recordHistory({
            gameId: 'teen-patti',
            gameName: 'Teen Patti',
            betAmount: settlement.betAmount,
            winAmount: settlement.grossPayout,
            outcome: settlement.summaryText,
            multiplier: settlement.multiplier,
            settlementStatus: 'settled'
          });
        }
      }

      // Determine top winner for recent history
      let bestPlayer = userPlayer;
      let bestScore = -1;
      teenPattiState.players.forEach((p) => {
        const ev = evaluateTeenPattiHand(p.cards);
        if (ev.score > bestScore) {
          bestScore = ev.score;
          bestPlayer = p;
        }
      });
      const dealerEval = evaluateTeenPattiHand(teenPattiState.dealer!.cards);
      if (dealerEval.score > bestScore) {
        teenPattiState.winnerId = 'dealer';
        teenPattiState.winnerHand = `Dealer wins with ${dealerEval.rankName}`;
      } else {
        teenPattiState.winnerId = bestPlayer?.id || 'dealer';
        teenPattiState.winnerHand = `${bestPlayer?.name} with ${bestPlayer?.handRankName}`;
        if (bestPlayer && bestPlayer.name) {
          teenPattiState.recentWinners.unshift({
            name: bestPlayer.name,
            amount: Math.round(teenPattiState.pot * 0.8),
            hand: bestPlayer.handRankName || 'High Card'
          });
          if (teenPattiState.recentWinners.length > 10) teenPattiState.recentWinners.pop();
        }
      }

      teenPattiState.phase = 'result';
      teenPattiState.countdown = 4;
      teenPattiState.phaseEndsAt = Date.now() + 4000;

      const sanitized = sanitizeTeenPattiState(teenPattiState);
      broadcastSSE('teen_patti_result', {
        roundId: teenPattiState.roundId,
        phase: 'result',
        state: sanitized,
        userSettlement: userSettlementDetail,
        dealer: teenPattiState.dealer
      });
      if (userSettlementDetail) {
        broadcastSSE('teen_patti_settlement', userSettlementDetail);
      }
      broadcastSSE('wallet_updated', { userId: userPlayer?.id });
    }
  } else if (teenPattiState.phase === 'result') {
    teenPattiState.countdown -= 1;
    if (teenPattiState.countdown <= 0) {
      teenPattiState = createAuthoritativeTeenPattiRound('Player', undefined, 50);
      broadcastSSE('teen_patti_round_started', {
        roundId: teenPattiState.roundId,
        countdown: 15,
        bettingEndsAt: teenPattiState.bettingEndsAt
      });
      broadcastSSE('teen_patti_betting_open', {
        roundId: teenPattiState.roundId,
        countdown: 15
      });
    }
  }
  await safeSaveAuthoritativeGameState('teen-patti', teenPattiState);
}, 1000);

// --- TEEN PATTI API ENDPOINTS ---
const handleGetTeenPattiState = (_req: Request, res: Response) => {
  res.json({
    state: sanitizeTeenPattiState(teenPattiState)
  });
};

app.get('/api/games/teen-patti/state', requireAuth, requirePlayerForGames, handleGetTeenPattiState);

const handlePostTeenPattiBet = async (req: Request, res: Response) => {
  const { amount }: { amount: number } = req.body;
  const betAmount = Number(amount);
  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }
  if (teenPattiState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is closed for this round' });
  }
  const userWallet = await supabaseRepo.getWallet(req.user!.id);
  const userPlayer = teenPattiState.players.find((p) => p.isUser);
  if (!userPlayer) return res.status(400).json({ error: 'User player not found' });

  // Calculate delta if player already has a bet
  const additionalBet = betAmount > userPlayer.currentBet ? betAmount - userPlayer.currentBet : betAmount;
  if (userWallet.balance < additionalBet) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  try { await debitForUser(req, additionalBet, `Teen Patti Bet #${teenPattiState.roundId}`, 'teen-patti'); } catch (e: any) {
    return res.status(400).json({ error: 'Failed to place bet' });
  }

  if (betAmount > userPlayer.currentBet) {
    userPlayer.currentBet = betAmount;
  } else {
    userPlayer.currentBet += additionalBet;
  }
  teenPattiState.pot += additionalBet;

  broadcastSSE('teen_patti_bet_placed', {
    roundId: teenPattiState.roundId,
    playerId: userPlayer.id,
    betAmount: userPlayer.currentBet,
    pot: teenPattiState.pot
  });

  return res.json({
    success: true,
    state: sanitizeTeenPattiState(teenPattiState),
    wallet: await supabaseRepo.getWallet(req.user!.id)
  });
};

app.post('/api/games/teen-patti/bet', requireAuth, requirePlayerForGames, handlePostTeenPattiBet);

const handlePostTeenPattiNewRound = async (req: Request, res: Response) => {
  const bootAmount = Number(req.body?.bootAmount || 50);
  const userPlayer = teenPattiState.players.find((p) => p.isUser);
  if (userPlayer && teenPattiState.phase === 'betting') {
    if (userPlayer.currentBet < bootAmount) {
      const delta = bootAmount - userPlayer.currentBet;
      try {
        await debitForUser(req, delta, 'Teen Patti Boot Bet', 'teen-patti');
        userPlayer.currentBet = bootAmount;
        teenPattiState.pot += delta;
      } catch (e: any) {
        return res.status(400).json({ error: 'Failed to place boot bet' });
      }
    }
  }

  return res.json({
    success: true,
    state: sanitizeTeenPattiState(teenPattiState),
    wallet: await supabaseRepo.getWallet(req.user!.id)
  });
};

app.post('/api/games/teen-patti/new-round', requireAuth, requirePlayerForGames, handlePostTeenPattiNewRound);

const handlePostTeenPattiAction = async (req: Request, res: Response) => {
  const { action, betAmount = 0 }: { action: 'see' | 'blind' | 'chaal' | 'fold' | 'show' | 'bet'; betAmount?: number } =
    req.body;

  const userPlayer = teenPattiState.players.find((p) => p.isUser);
  if (!userPlayer) return res.status(400).json({ error: 'Player not found' });

  if (action === 'see') {
    userPlayer.seen = true;
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), userCards: userPlayer.cards });
  }

  if (action === 'fold') {
    userPlayer.folded = true;
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), wallet: await supabaseRepo.getWallet(req.user!.id) });
  }

  if (action === 'blind' || action === 'chaal' || action === 'bet') {
    const stake = betAmount > 0 ? betAmount : teenPattiState.currentStake;
    if (teenPattiState.phase !== 'betting') {
      return res.status(400).json({ error: 'Betting is closed for this round' });
    }
    try { await debitForUser(req, stake, `Teen Patti ${action.toUpperCase()}`, 'teen-patti'); } catch (e: any) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    userPlayer.currentBet += stake;
    teenPattiState.pot += stake;
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), wallet: await supabaseRepo.getWallet(req.user!.id) });
  }

  if (action === 'show') {
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), wallet: await supabaseRepo.getWallet(req.user!.id) });
  }

  return res.status(400).json({ error: 'Unknown action' });
};

app.post('/api/games/teen-patti/action', requireAuth, requirePlayerForGames, handlePostTeenPattiAction);

// Persist the authoritative round after every scheduler tick.
// The lease ensures only one instance advances the round.

// -------------------------------------------------------------

}
