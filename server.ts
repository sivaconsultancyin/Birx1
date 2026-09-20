import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  Card,
  GameHistoryEntry,
  RouletteBet,
  RouletteState,
  TeenPattiPlayer,
  TeenPattiState,
  AviatorBet,
  AviatorState,
  DiceState,
  DragonTigerState,
  DragonTigerBetSide,
  AndarBaharState,
  AndarBaharSide,
  Transaction,
  User,
  UserRole,
  Wallet
} from './src/types.ts';
import {
  generateDeck,
  secureShuffleDeck,
  evaluateTeenPattiHand,
  compareHands,
  computePlayerSettlement,
  createAuthoritativeTeenPattiRound,
  sanitizeTeenPattiState
} from './src/engines/teenPattiEngine.ts';
import { supabaseRepo, getSupabaseConfigStatus } from './src/server/supabase/supabaseClient.ts';
import { authService, requireAuth, requirePlayerForGames, requireRoles } from './src/server/auth/authService.ts';
import { walletService } from './src/server/wallet/walletService.ts';
import { storageService } from './src/server/storage/storageService.ts';
import { gameRecoveryService } from './src/server/recovery/gameRecoveryService.ts';

const app = express();
const PORT = 3000;

app.use(express.json());

function requireActor(req: Request): User {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
}

async function getRequestWallet(req: Request): Promise<Wallet> {
  return supabaseRepo.getWallet(requireActor(req).id);
}

let activeTeenPattiUser: User | null = null;

// -------------------------------------------------------------
// SERVER-AUTHORITATIVE GAME STATE
// Financial identity and wallet always come from authenticated Supabase user.
// -------------------------------------------------------------

// -------------------------------------------------------------
// AUTH API
// -------------------------------------------------------------
app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const mobile = String(req.body?.mobile || '');
    return res.json(await authService.sendOtp(mobile));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'OTP send failed' });
  }
});

app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const mobile = String(req.body?.mobile || '');
    const otp = String(req.body?.otp || '');
    if (!mobile || !otp) return res.status(400).json({ error: 'Mobile and OTP are required' });
    return res.json(await authService.verifyOtp(mobile, otp));
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'OTP verification failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  const user = requireActor(req);
  return res.json({ user, wallet: await getRequestWallet(req) });
});

app.post('/api/auth/logout', requireAuth, async (_req: Request, res: Response) => {
  return res.json({ success: true, message: 'Sign out on the client using Supabase Auth.' });
});

app.post('/api/auth/register', (_req: Request, res: Response) => {
  return res.status(410).json({ error: 'Legacy registration disabled. Use Supabase phone OTP.' });
});

app.post('/api/auth/switch-role', (_req: Request, res: Response) => {
  return res.status(410).json({ error: 'Role switching disabled.' });
});

// -------------------------------------------------------------
// 2. TEEN PATTI ENGINE (SERVER-AUTHORITATIVE MULTIPLAYER)
// -------------------------------------------------------------
let teenPattiState: TeenPattiState = createAuthoritativeTeenPattiRound(
  activeTeenPattiUser?.username || 'You',
  activeTeenPattiUser?.avatarUrl,
  50
);

// Background Authoritative Teen Patti Round Cycle
setInterval(() => {
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
          await creditWallet(requireActor(req).id, settlement.grossPayout, `Teen Patti Win #${teenPattiState.roundId}`, 'teen-patti');
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
      broadcastSSE('wallet_updated', { wallet: await getRequestWallet(req) });
    }
  } else if (teenPattiState.phase === 'result') {
    teenPattiState.countdown -= 1;
    if (teenPattiState.countdown <= 0) {
      teenPattiState = createAuthoritativeTeenPattiRound(activeTeenPattiUser?.username || 'You', activeTeenPattiUser?.avatarUrl, 50);
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
}, 1000);

// --- TEEN PATTI API ENDPOINTS ---
const handleGetTeenPattiState = (req: Request, res: Response) => {
  activeTeenPattiUser = requireActor(req);
  res.json({
    state: sanitizeTeenPattiState(teenPattiState)
  });
};

app.get('/api/games/teen-patti/state', requireAuth, requirePlayerForGames, handleGetTeenPattiState);
app.get('/games/teen-patti/state', requireAuth, requirePlayerForGames,  requireAuth, handleGetTeenPattiState);

const handlePostTeenPattiBet = async (req: Request, res: Response) => {
  activeTeenPattiUser = requireActor(req);
  const { amount }: { amount: number } = req.body;
  const betAmount = Number(amount);
  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }
  if (teenPattiState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is closed for this round' });
  }
  const userPlayer = teenPattiState.players.find((p) => p.isUser);
  if (!userPlayer) return res.status(400).json({ error: 'User player not found' });

  // Calculate delta if player already has a bet
  const additionalBet = betAmount > userPlayer.currentBet ? betAmount - userPlayer.currentBet : betAmount;
  if ((await getRequestWallet(req)).balance < additionalBet) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  if (!(await deductWallet(requireActor(req).id, additionalBet, `Teen Patti Bet #${teenPattiState.roundId}`, 'teen-patti'))) {
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
    wallet: await getRequestWallet(req)
  });
};

app.post('/api/games/teen-patti/bet', requireAuth, requirePlayerForGames, handlePostTeenPattiBet);
app.post('/games/teen-patti/bet', requireAuth, requirePlayerForGames, handlePostTeenPattiBet);

const handlePostTeenPattiNewRound = async (req: Request, res: Response) => {
  activeTeenPattiUser = requireActor(req);
  const bootAmount = Number(req.body?.bootAmount || 50);
  const userPlayer = teenPattiState.players.find((p) => p.isUser);
  if (userPlayer && teenPattiState.phase === 'betting') {
    if (userPlayer.currentBet < bootAmount) {
      const delta = bootAmount - userPlayer.currentBet;
      if ((await getRequestWallet(req)).balance >= delta && (await deductWallet(requireActor(req).id, delta, 'Teen Patti Boot Bet', 'teen-patti'))) {
        userPlayer.currentBet = bootAmount;
        teenPattiState.pot += delta;
      }
    }
  }

  return res.json({
    success: true,
    state: sanitizeTeenPattiState(teenPattiState),
    wallet: await getRequestWallet(req)
  });
};

app.post('/api/games/teen-patti/new-round', requireAuth, requirePlayerForGames, handlePostTeenPattiNewRound);
app.post('/games/teen-patti/new-round', requireAuth, requirePlayerForGames, handlePostTeenPattiNewRound);

const handlePostTeenPattiAction = async (req: Request, res: Response) => {
  activeTeenPattiUser = requireActor(req);
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
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), wallet: await getRequestWallet(req) });
  }

  if (action === 'blind' || action === 'chaal' || action === 'bet') {
    const stake = betAmount > 0 ? betAmount : teenPattiState.currentStake;
    if (teenPattiState.phase !== 'betting') {
      return res.status(400).json({ error: 'Betting is closed for this round' });
    }
    if (!(await deductWallet(requireActor(req).id, stake, `Teen Patti ${action.toUpperCase()}`, 'teen-patti'))) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    userPlayer.currentBet += stake;
    teenPattiState.pot += stake;
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), wallet: await getRequestWallet(req) });
  }

  if (action === 'show') {
    return res.json({ success: true, state: sanitizeTeenPattiState(teenPattiState), wallet: await getRequestWallet(req) });
  }

  return res.status(400).json({ error: 'Unknown action' });
};

app.post('/api/games/teen-patti/action', requireAuth, requirePlayerForGames, handlePostTeenPattiAction);
app.post('/games/teen-patti/action', requireAuth, requirePlayerForGames, handlePostTeenPattiAction);

// -------------------------------------------------------------
// 3. AVIATOR ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
let aviatorState: AviatorState = {
  roundId: 'AV-' + Math.floor(1000 + Math.random() * 9000),
  phase: 'betting',
  multiplier: 1.0,
  crashMultiplier: null,
  countdown: 5,
  previousMultipliers: [2.14, 1.35, 12.8, 1.88, 3.42, 1.05, 5.61]
};

let currentAviatorBet: AviatorBet | null = null;
let currentCrashTarget = generateCrashPoint();
let aviatorTimer: NodeJS.Timeout | null = null;

function generateCrashPoint(): number {
  // Classic Provably Fair distribution: 1 / (1 - U) with 3% house edge
  const rand = Math.random();
  if (rand < 0.05) return 1.0 + Number((Math.random() * 0.15).toFixed(2)); // instant bust 1.00 - 1.15
  const raw = 0.97 / (1 - rand);
  const clamped = Math.min(raw, 50.0);
  return Number(Math.max(1.05, clamped).toFixed(2));
}

function runAviatorCycle() {
  if (aviatorTimer) clearInterval(aviatorTimer);

  // Phase 1: Betting (5 seconds countdown)
  aviatorState.phase = 'betting';
  aviatorState.multiplier = 1.0;
  aviatorState.crashMultiplier = null;
  aviatorState.countdown = 5;
  aviatorState.roundId = 'AV-' + Math.floor(1000 + Math.random() * 9000);
  currentAviatorBet = null;
  currentCrashTarget = generateCrashPoint();

  broadcastSSE('round_started', { gameId: 'aviator', roundId: aviatorState.roundId });

  const betInterval = setInterval(() => {
    aviatorState.countdown -= 1;
    if (aviatorState.countdown <= 0) {
      clearInterval(betInterval);
      startAviatorFlight();
    }
  }, 1000);
}

function startAviatorFlight() {
  aviatorState.phase = 'running';
  aviatorState.multiplier = 1.0;

  broadcastSSE('betting_closed', { gameId: 'aviator' });

  const startTime = Date.now();
  const flightInterval = setInterval(() => {
    const elapsedSec = (Date.now() - startTime) / 1000;
    // Exponential curve: 1 + 0.06 * t^1.7
    const nextMult = Number((1.0 + 0.06 * Math.pow(elapsedSec * 1.8, 1.6)).toFixed(2));

    if (nextMult >= currentCrashTarget) {
      clearInterval(flightInterval);
      aviatorState.multiplier = currentCrashTarget;
      aviatorState.crashMultiplier = currentCrashTarget;
      aviatorState.phase = 'crashed';
      aviatorState.previousMultipliers.unshift(currentCrashTarget);
      if (aviatorState.previousMultipliers.length > 15) aviatorState.previousMultipliers.pop();

      // If user had an active bet that didn't cash out -> settled as loss
      if (currentAviatorBet && !currentAviatorBet.cashedOut) {
        recordHistory({
          gameId: 'aviator',
          gameName: 'Aviator',
          betAmount: currentAviatorBet.amount,
          winAmount: 0,
          outcome: `Flew away @ ${currentCrashTarget}x`,
          multiplier: 0,
          settlementStatus: 'settled'
        });
      }

      broadcastSSE('result', {
        gameId: 'aviator',
        multiplier: currentCrashTarget,
        crashed: true
      });

      // Restart cycle after 3s
      setTimeout(() => {
        runAviatorCycle();
      }, 3500);
    } else {
      aviatorState.multiplier = nextMult;
    }
  }, 100);
}

// Start initial aviator flight cycle
runAviatorCycle();

app.get('/api/games/aviator/state', requireAuth, requirePlayerForGames, (_req: Request, res: Response) => {
  res.json({
    state: {
      ...aviatorState,
      currentBet: currentAviatorBet
    }
  });
});

app.post('/api/games/aviator/bet', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const { amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (aviatorState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is closed for this round' });
  }

  if (!(await deductWallet(requireActor(req).id, numAmount, `Aviator Bet #${aviatorState.roundId}`, 'aviator'))) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  currentAviatorBet = {
    betId: `av_bet_${Date.now()}`,
    amount: numAmount,
    cashedOut: false
  };

  return res.json({
    success: true,
    bet: currentAviatorBet,
    wallet: await getRequestWallet(req)
  });
});

app.post('/api/games/aviator/cashout', requireAuth, requirePlayerForGames, async (_req: Request, res: Response) => {
  if (!currentAviatorBet || currentAviatorBet.cashedOut) {
    return res.status(400).json({ error: 'No active bet to cash out' });
  }

  if (aviatorState.phase !== 'running') {
    return res.status(400).json({ error: 'Aircraft has already crashed or round ended' });
  }

  // Authoritative payout calculated strictly on server
  const cashMultiplier = aviatorState.multiplier;
  const payout = Math.floor(currentAviatorBet.amount * cashMultiplier);

  currentAviatorBet.cashedOut = true;
  currentAviatorBet.cashOutMultiplier = cashMultiplier;
  currentAviatorBet.winAmount = payout;

  await creditWallet(requireActor(req).id, payout, `Aviator Cashout @ ${cashMultiplier}x`, 'aviator');

  recordHistory({
    gameId: 'aviator',
    gameName: 'Aviator',
    betAmount: currentAviatorBet.amount,
    winAmount: payout,
    outcome: `Cashed out @ ${cashMultiplier}x`,
    multiplier: cashMultiplier,
    settlementStatus: 'settled'
  });

  return res.json({
    success: true,
    cashMultiplier,
    winAmount: payout,
    wallet: await getRequestWallet(req)
  });
});

// -------------------------------------------------------------
// 4. DICE ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
let diceState: DiceState = {
  roundId: 'DC-' + Math.floor(1000 + Math.random() * 9000),
  phase: 'betting',
  dice1: 4,
  dice2: 3,
  sum: 7,
  recentSums: [7, 10, 4, 11, 6, 8],
  countdown: 10
};

app.get('/api/games/dice/state', requireAuth, requirePlayerForGames, (_req: Request, res: Response) => {
  res.json({ state: diceState });
});

app.post('/api/games/dice/roll', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const { betType, amount }: { betType: 'under7' | 'exact7' | 'over7' | 'even' | 'odd' | 'doubles'; amount: number } =
    req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (!(await deductWallet(requireActor(req).id, numAmount, `Dice Bet: ${betType}`, 'dice'))) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Authoritative server dice generation
  const d1 = Math.floor(1 + Math.random() * 6);
  const d2 = Math.floor(1 + Math.random() * 6);
  const total = d1 + d2;
  const isDoubles = d1 === d2;

  let multiplier = 0;
  if (betType === 'under7' && total < 7) multiplier = 2.0;
  else if (betType === 'over7' && total > 7) multiplier = 2.0;
  else if (betType === 'exact7' && total === 7) multiplier = 5.5;
  else if (betType === 'even' && total % 2 === 0) multiplier = 1.95;
  else if (betType === 'odd' && total % 2 !== 0) multiplier = 1.95;
  else if (betType === 'doubles' && isDoubles) multiplier = 5.5;

  const winAmount = Math.floor(numAmount * multiplier);
  if (winAmount > 0) {
    await creditWallet(requireActor(req).id, winAmount, `Dice Win (${d1}+${d2}=${total})`, 'dice');
  }

  diceState.dice1 = d1;
  diceState.dice2 = d2;
  diceState.sum = total;
  diceState.recentSums.unshift(total);
  if (diceState.recentSums.length > 10) diceState.recentSums.pop();
  diceState.roundId = 'DC-' + Math.floor(1000 + Math.random() * 9000);

  recordHistory({
    gameId: 'dice',
    gameName: 'Dice',
    betAmount: numAmount,
    winAmount,
    outcome: `Rolled [${d1}, ${d2}] = ${total} (${winAmount > 0 ? 'Won' : 'Lost'})`,
    multiplier,
    settlementStatus: 'settled'
  });

  return res.json({
    success: true,
    dice1: d1,
    dice2: d2,
    sum: total,
    isDoubles,
    multiplier,
    winAmount,
    wallet: await getRequestWallet(req),
    recentSums: diceState.recentSums
  });
});

// -------------------------------------------------------------
// 5. DRAGON TIGER ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
let dragonTigerState: DragonTigerState = {
  roundId: 'DT-' + Math.floor(1000 + Math.random() * 9000),
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

  if (!(await deductWallet(requireActor(req).id, numAmount, `Dragon Tiger: ${betSide.toUpperCase()}`, 'dragon-tiger'))) {
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
    await creditWallet(requireActor(req).id, winAmount, `Dragon Tiger Win (${winner.toUpperCase()})`, 'dragon-tiger');
  }

  dragonTigerState.dragonCard = dragonCard;
  dragonTigerState.tigerCard = tigerCard;
  dragonTigerState.winner = winner;
  dragonTigerState.recentResults.unshift(winner);
  if (dragonTigerState.recentResults.length > 15) dragonTigerState.recentResults.pop();
  dragonTigerState.roundId = 'DT-' + Math.floor(1000 + Math.random() * 9000);

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
    wallet: await getRequestWallet(req),
    recentResults: dragonTigerState.recentResults
  });
});

// -------------------------------------------------------------
// 6. ANDAR BAHAR ENGINE (SERVER-AUTHORITATIVE WITH LIVE SHUFFLE & DEALING)
// -------------------------------------------------------------
let activeAndarBaharBet: { side: AndarBaharSide; amount: number } | null = null;
let andarBaharDealtQueue: { side: AndarBaharSide; card: Card }[] = [];
let andarBaharTargetJoker: Card | null = { suit: 'spades', rank: '8', value: 8 };
let andarBaharFinalWinner: AndarBaharSide = 'andar';

let andarBaharState: AndarBaharState = {
  roundId: 'AB-' + Math.floor(1000 + Math.random() * 9000),
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

  andarBaharState.roundId = 'AB-' + Math.floor(1000 + Math.random() * 9000);
  andarBaharState.phase = 'betting';
  andarBaharState.countdown = 10;
  andarBaharState.jokerCard = null;
  andarBaharState.dealtCards = [];
  andarBaharState.winningSide = null;
  andarBaharState.phaseEndsAt = Date.now() + 10000;
  andarBaharState.startedAt = Date.now();
  andarBaharState.userBet = activeAndarBaharBet || undefined;
  andarBaharState.userSettlement = undefined;

  broadcastSSE('andar_bahar_state_update', { state: andarBaharState });
}

// Background Authoritative Andar Bahar Round Cycle
setInterval(() => {
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
      if (activeAndarBaharBet) {
        const numAmount = activeAndarBaharBet.amount;
        const betSide = activeAndarBaharBet.side;
        const isWin = betSide === andarBaharFinalWinner;
        const multiplier = isWin ? (andarBaharFinalWinner === 'andar' ? 1.9 : 2.0) : 0;
        const winAmount = Math.floor(numAmount * multiplier);

        if (winAmount > 0) {
          await creditWallet(requireActor(req).id, winAmount, `Andar Bahar Win on ${andarBaharFinalWinner.toUpperCase()}`, 'andar-bahar');
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

        activeAndarBaharBet = null;
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

app.get('/api/games/andar-bahar/state', requireAuth, requirePlayerForGames, (_req: Request, res: Response) => {
  res.json({
    state: {
      ...andarBaharState,
      userBet: activeAndarBaharBet || undefined
    }
  });
});

app.post('/api/games/andar-bahar/deal', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const { betSide, amount }: { betSide: AndarBaharSide; amount: number } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (!(await deductWallet(requireActor(req).id, numAmount, `Andar Bahar: ${betSide.toUpperCase()}`, 'andar-bahar'))) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Register bet on active server-authoritative round
  activeAndarBaharBet = { side: betSide, amount: numAmount };
  andarBaharState.userBet = activeAndarBaharBet;

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
    wallet: await getRequestWallet(req),
    recentWinners: andarBaharState.recentWinners,
    state: andarBaharState
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & STATIC FALLBACK
// -------------------------------------------------------------
async function start() {
  // Execute database state recovery for any interrupted game rounds or unconfirmed transactions
  try {
    await gameRecoveryService.recoverInterruptedRounds();
  } catch (e: any) {
    console.warn('[Recovery] Non-fatal recovery warning:', e?.message);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Brix Games Engine] Server live on http://0.0.0.0:${PORT}`);
    console.log(`[Supabase Platform] Connected status:`, getSupabaseConfigStatus().isConfigured ? 'LIVE POSTGRESQL' : 'READY STORE');
  });
}

start();
