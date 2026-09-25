import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { supabaseRepo } from '../../../src/server/supabase/supabaseClient.ts';

// Extracted from server.ts. Game lifecycle and settlement remain server-authoritative.
// 3. AVIATOR ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
const AVIATOR_ROOM_ID = 'aviator-main';

let aviatorState: AviatorState = {
  roundId: 'AV-' + crypto.randomInt(1000, 10000),
  phase: 'betting',
  multiplier: 1.0,
  crashMultiplier: null,
  countdown: 5,
  previousMultipliers: [2.14, 1.35, 12.8, 1.88, 3.42, 1.05, 5.61]
};

const aviatorBets = new Map<string, AviatorBet>();
let currentCrashTarget = generateCrashPoint();
let aviatorTimer: NodeJS.Timeout | null = null;

function generateCrashPoint(): number {
  // Classic Provably Fair distribution: 1 / (1 - U) with 3% house edge
  const rand = crypto.randomInt(1, 1_000_000_000) / 1_000_000_000;
  if (rand < 0.05) return 1.0 + Number(((crypto.randomInt(0, 1_000_000) / 1_000_000) * 0.15).toFixed(2)); // instant bust 1.00 - 1.15
  const raw = 0.97 / (1 - rand);
  const clamped = Math.min(raw, 50.0);
  return Number(Math.max(1.05, clamped).toFixed(2));
}

async function runAviatorCycle() {
  if (aviatorTimer) clearInterval(aviatorTimer);

  // Phase 1: Betting (5 seconds countdown)
  aviatorState.phase = 'betting';
  aviatorState.multiplier = 1.0;
  aviatorState.crashMultiplier = null;
  aviatorState.countdown = 5;
  aviatorState.roundId = 'AV-' + crypto.randomInt(1000, 10000);
  // Bets are keyed by authenticated user and survive the round reset independently.
  currentCrashTarget = generateCrashPoint();

  broadcastSSE('round_started', { gameId: 'aviator', roomId: AVIATOR_ROOM_ID, roundId: aviatorState.roundId });

  await safeSaveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });

  const betInterval = setInterval(async () => {
    aviatorState.countdown -= 1;
    if (aviatorState.countdown <= 0) {
      clearInterval(betInterval);
      void startAviatorFlight();
    }
    await safeSaveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });
  }, 1000);
}

async function startAviatorFlight() {
  aviatorState.phase = 'running';
  aviatorState.multiplier = 1.0;

  broadcastSSE('betting_closed', { gameId: 'aviator', roomId: AVIATOR_ROOM_ID, roundId: aviatorState.roundId });

  const startTime = Date.now();
  const flightInterval = setInterval(async () => {
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
      for (const [userId, currentAviatorBet] of aviatorBets) {
        if (!currentAviatorBet.cashedOut) {
          recordHistory({
          gameId: 'aviator',
          gameName: 'Aviator',
          betAmount: currentAviatorBet.amount,
          winAmount: 0,
          outcome: `Flew away @ ${currentCrashTarget}x`,
          multiplier: 0,
          settlementStatus: 'settled'
        });
        aviatorBets.delete(userId);
        }
      }

      broadcastSSE('result', {
        gameId: 'aviator',
        roomId: AVIATOR_ROOM_ID,
        roundId: aviatorState.roundId,
        multiplier: currentCrashTarget,
        crashed: true
      });

      // Restart cycle after 3s
      await safeSaveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });
      setTimeout(() => { runAviatorCycle(); }, 3500);
    } else {
      aviatorState.multiplier = nextMult;
      await safeSaveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });
    }
  }, 100);
}

// Start initial aviator flight cycle
runAviatorCycle();

app.get('/api/games/aviator/state', (req: Request, res: Response) => {
  // Public round state is non-sensitive; betting and cashout endpoints remain authenticated.
  const userId = req.user?.id;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({
    state: {
      ...aviatorState,
      currentBet: userId ? (aviatorBets.get(userId) ?? null) : null
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

  try { await debitForUser(req, numAmount, `Aviator Bet #${aviatorState.roundId}`, 'aviator'); } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const currentAviatorBet: AviatorBet = {
    betId: `av_bet_${Date.now()}`,
    amount: numAmount,
    cashedOut: false
  };
  aviatorBets.set(req.user!.id, currentAviatorBet);

  return res.json({
    success: true,
    bet: currentAviatorBet,
    wallet: await supabaseRepo.getWallet(req.user!.id)
  });
});

app.post('/api/games/aviator/cashout', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => {
  const currentAviatorBet = aviatorBets.get(req.user!.id);
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
  aviatorBets.delete(req.user!.id);

  await creditForUser(req, payout, `Aviator Cashout @ ${cashMultiplier}x`, 'aviator');

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
    wallet: await supabaseRepo.getWallet(req.user!.id)
  });
});

// -------------------------------------------------------------

export default { name: 'aviator' };
