import type { DiceState } from '../../../src/types.ts';
import crypto from 'node:crypto';

// Extracted from server.ts. Game lifecycle and settlement remain server-authoritative.
// 4. DICE ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
let diceState: DiceState = {
  roundId: 'DC-' + crypto.randomInt(1000, 10000),
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

  try { await debitForUser(req, numAmount, `Dice Bet: ${betType}`, 'dice'); } catch (e: any) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Authoritative server dice generation
  const d1 = crypto.randomInt(1, 7);
  const d2 = crypto.randomInt(1, 7);
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
    await creditForUser(req, winAmount, `Dice Win (${d1}+${d2}=${total})`, 'dice');
  }

  diceState.dice1 = d1;
  diceState.dice2 = d2;
  diceState.sum = total;
  diceState.recentSums.unshift(total);
  if (diceState.recentSums.length > 10) diceState.recentSums.pop();
  diceState.roundId = 'DC-' + crypto.randomInt(1000, 10000);

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
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentSums: diceState.recentSums
  });
});

// -------------------------------------------------------------

export const diceGameModule = { gameId: 'dice', source: 'server-authoritative' } as const;
export default diceGameModule;
