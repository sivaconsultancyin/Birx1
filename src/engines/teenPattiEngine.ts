import { Card, TeenPattiHandRank, TeenPattiPlayer, TeenPattiState, TeenPattiDealer } from '../types.ts';

// -------------------------------------------------------------
// CONSTANTS & RULES
// -------------------------------------------------------------
export const SUITS: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: ('2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A')[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
];

export const TEEN_PATTI_PAYOUT_MULTIPLIERS: Record<TeenPattiHandRank, number> = {
  'Trail / Trio': 5,
  'Pure Sequence': 4,
  'Sequence': 3,
  'Color / Flush': 2,
  'Pair': 1,
  'High Card': 1
};

export const MAX_PLAYERS = 16;
export const BETTING_DURATION_SEC = 15;
export const LOCK_DURATION_SEC = 1;
export const DEAL_DURATION_SEC = 5;
export const COMPARE_DURATION_SEC = 2;
export const RESULT_DURATION_SEC = 4;

export function getRankValue(r: string): number {
  if (r === 'A') return 14;
  if (r === 'K') return 13;
  if (r === 'Q') return 12;
  if (r === 'J') return 11;
  return Number(r);
}

// -------------------------------------------------------------
// 1. 52-CARD DECK GENERATOR
// -------------------------------------------------------------
export function generateDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ suit: s, rank: r, value: getRankValue(r) });
    }
  }
  return deck;
}

// -------------------------------------------------------------
// 2. CRYPTOGRAPHICALLY SECURE SHUFFLE (FISHER-YATES)
// -------------------------------------------------------------
export function secureShuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  const len = shuffled.length;

  // Environment-safe cryptographic RNG
  let getRandomInt: (maxExclusive: number) => number;

  try {
    // Node.js crypto module
    const nodeCrypto = typeof process !== 'undefined' && process.versions?.node
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        eval('require("crypto")')
      : null;
    if (nodeCrypto && typeof nodeCrypto.randomInt === 'function') {
      getRandomInt = (max) => nodeCrypto.randomInt(0, max);
    } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      getRandomInt = (max) => {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return arr[0] % max;
      };
    } else {
      getRandomInt = (max) => Math.floor(Math.random() * max);
    }
  } catch {
    getRandomInt = (max) => Math.floor(Math.random() * max);
  }

  for (let i = len - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  return shuffled;
}

// -------------------------------------------------------------
// 3. HAND EVALUATION (TEEN PATTI AUTHORITATIVE)
// -------------------------------------------------------------
// Ranking Order:
// 1. Trail / Trio (Three of a Kind)
// 2. Pure Sequence (Straight Flush)
// 3. Sequence (Straight)
// 4. Color / Flush
// 5. Pair
// 6. High Card
// -------------------------------------------------------------
export interface HandEvaluation {
  rankName: TeenPattiHandRank;
  score: number;
  multiplier: number;
  description: string;
}

export function evaluateTeenPattiHand(cards: Card[]): HandEvaluation {
  if (!cards || cards.length < 3) {
    return {
      rankName: 'High Card',
      score: 0,
      multiplier: 1,
      description: 'Incomplete Hand'
    };
  }

  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const v1 = sorted[0].value;
  const v2 = sorted[1].value;
  const v3 = sorted[2].value;

  const isFlush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;

  // Sequences in Teen Patti:
  // Normal sequences: v1 === v2 + 1 && v2 === v3 + 1 (e.g. A-K-Q: 14-13-12, K-Q-J: 13-12-11)
  // Special Sequence wrap: A-2-3 (values: 14, 3, 2). In Teen Patti, A-2-3 is recognized as second highest sequence after A-K-Q.
  const isNormalSeq = v1 === v2 + 1 && v2 === v3 + 1;
  const isA23Seq = v1 === 14 && v2 === 3 && v3 === 2;
  const isSequence = isNormalSeq || isA23Seq;

  // Effective sequence strength for comparison:
  // A-K-Q = 14 (highest)
  // A-2-3 = 13.5 (second highest in standard Teen Patti)
  // K-Q-J = 13
  // ... 4-3-2 = 4 (lowest)
  const seqWeight = isA23Seq ? 13.5 : v1;

  const isTrio = v1 === v2 && v2 === v3;
  const isPair = v1 === v2 || v2 === v3 || v1 === v3;

  // 1. Trail / Trio (Multiplier = 5x)
  if (isTrio) {
    return {
      rankName: 'Trail / Trio',
      score: 600000 + v1 * 100,
      multiplier: TEEN_PATTI_PAYOUT_MULTIPLIERS['Trail / Trio'],
      description: `Three of a kind (${sorted[0].rank}'s)`
    };
  }

  // 2. Pure Sequence (Multiplier = 4x)
  if (isSequence && isFlush) {
    return {
      rankName: 'Pure Sequence',
      score: 500000 + seqWeight * 100,
      multiplier: TEEN_PATTI_PAYOUT_MULTIPLIERS['Pure Sequence'],
      description: isA23Seq ? 'Pure Sequence A-2-3' : `Pure Sequence ${sorted[0].rank}-high`
    };
  }

  // 3. Sequence (Multiplier = 3x)
  if (isSequence) {
    return {
      rankName: 'Sequence',
      score: 400000 + seqWeight * 100,
      multiplier: TEEN_PATTI_PAYOUT_MULTIPLIERS['Sequence'],
      description: isA23Seq ? 'Sequence A-2-3' : `Sequence ${sorted[0].rank}-high`
    };
  }

  // 4. Color / Flush (Multiplier = 2x)
  if (isFlush) {
    return {
      rankName: 'Color / Flush',
      score: 300000 + v1 * 100 + v2 * 10 + v3,
      multiplier: TEEN_PATTI_PAYOUT_MULTIPLIERS['Color / Flush'],
      description: `Flush ${sorted[0].rank}-${sorted[1].rank}-${sorted[2].rank} of ${sorted[0].suit}`
    };
  }

  // 5. Pair (Multiplier = 1x)
  if (isPair) {
    const pairVal = v1 === v2 ? v1 : v2 === v3 ? v2 : v1;
    const kicker = v1 === v2 ? v3 : v2 === v3 ? v1 : v2;
    const pairCard = sorted.find((c) => c.value === pairVal);
    return {
      rankName: 'Pair',
      score: 200000 + pairVal * 100 + kicker,
      multiplier: TEEN_PATTI_PAYOUT_MULTIPLIERS['Pair'],
      description: `Pair of ${pairCard?.rank || pairVal}'s`
    };
  }

  // 6. High Card (Multiplier = 1x)
  return {
    rankName: 'High Card',
    score: 100000 + v1 * 100 + v2 * 10 + v3,
    multiplier: TEEN_PATTI_PAYOUT_MULTIPLIERS['High Card'],
    description: `High Card ${sorted[0].rank}`
  };
}

// -------------------------------------------------------------
// 4. PLAYER VS DEALER COMPARISON
// -------------------------------------------------------------
export type RoundComparisonResult = 'player_win' | 'dealer_win' | 'tie';

export function compareHands(playerCards: Card[], dealerCards: Card[]): {
  outcome: RoundComparisonResult;
  playerEval: HandEvaluation;
  dealerEval: HandEvaluation;
} {
  const playerEval = evaluateTeenPattiHand(playerCards);
  const dealerEval = evaluateTeenPattiHand(dealerCards);

  if (playerEval.score > dealerEval.score) {
    return { outcome: 'player_win', playerEval, dealerEval };
  } else if (playerEval.score < dealerEval.score) {
    return { outcome: 'dealer_win', playerEval, dealerEval };
  } else {
    return { outcome: 'tie', playerEval, dealerEval };
  }
}

// -------------------------------------------------------------
// 5. SETTLEMENT COMPUTATION (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
export interface PlayerSettlement {
  playerId: string;
  isUser: boolean;
  betAmount: number;
  outcome: RoundComparisonResult;
  multiplier: number;
  grossPayout: number;
  netProfit: number;
  playerHandRank: TeenPattiHandRank;
  dealerHandRank: TeenPattiHandRank;
  summaryText: string;
}

export function computePlayerSettlement(
  betAmount: number,
  playerCards: Card[],
  dealerCards: Card[],
  playerId: string = 'user_me',
  isUser: boolean = true
): PlayerSettlement {
  if (betAmount <= 0) {
    const { playerEval, dealerEval } = compareHands(playerCards, dealerCards);
    return {
      playerId,
      isUser,
      betAmount: 0,
      outcome: 'tie',
      multiplier: 0,
      grossPayout: 0,
      netProfit: 0,
      playerHandRank: playerEval.rankName,
      dealerHandRank: dealerEval.rankName,
      summaryText: 'No bet placed'
    };
  }

  const { outcome, playerEval, dealerEval } = compareHands(playerCards, dealerCards);

  let multiplier = 0;
  let grossPayout = 0;
  let netProfit = 0;
  let summaryText = '';

  if (outcome === 'player_win') {
    multiplier = playerEval.multiplier;
    // Win: original bet + (bet * multiplier)
    grossPayout = betAmount + betAmount * multiplier;
    netProfit = betAmount * multiplier;
    summaryText = `Won ₹${(netProfit ?? 0).toLocaleString('en-IN')} with ${playerEval.rankName} (${multiplier}x payout)`;
  } else if (outcome === 'tie') {
    // Tie / Push: bet returned
    multiplier = 1;
    grossPayout = betAmount;
    netProfit = 0;
    summaryText = `Push / Tie against Dealer (${playerEval.rankName})`;
  } else {
    // Loss: 0 payout
    multiplier = 0;
    grossPayout = 0;
    netProfit = -betAmount;
    summaryText = `Lost ₹${(betAmount ?? 0).toLocaleString('en-IN')} to Dealer's ${dealerEval.rankName}`;
  }

  return {
    playerId,
    isUser,
    betAmount,
    outcome,
    multiplier,
    grossPayout,
    netProfit,
    playerHandRank: playerEval.rankName,
    dealerHandRank: dealerEval.rankName,
    summaryText
  };
}

// -------------------------------------------------------------
// 6. BOT PLAYERS SEED DATA (UP TO 15 OPPONENTS + USER = 16 TOTAL)
// -------------------------------------------------------------
export const BOT_NAMES_AND_AVATARS = [
  { name: 'Vikram', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
  { name: 'Ananya', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
  { name: 'Rohan', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
  { name: 'Priya', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
  { name: 'Karan', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80' },
  { name: 'Sneha', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80' },
  { name: 'Arjun', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80' },
  { name: 'Diya', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80' },
  { name: 'Kabir', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80' },
  { name: 'Isha', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80' },
  { name: 'Aarav', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80' },
  { name: 'Tara', avatar: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=100&auto=format&fit=crop&q=80' },
  { name: 'Siddharth', avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=100&auto=format&fit=crop&q=80' },
  { name: 'Meera', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&auto=format&fit=crop&q=80' },
  { name: 'Dev', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=100&auto=format&fit=crop&q=80' }
];

// -------------------------------------------------------------
// 7. DEALER PLACEHOLDER MASKING
// -------------------------------------------------------------
export const HIDDEN_CARD: Card = {
  suit: 'spades',
  rank: 'A',
  value: 0
};

export function maskDealerCards(cards: Card[]): Card[] {
  return cards.map(() => ({ ...HIDDEN_CARD }));
}

// -------------------------------------------------------------
// 8. AUTHORITATIVE ROUND CREATION
// -------------------------------------------------------------
export function createAuthoritativeTeenPattiRound(
  userUsername: string = 'You',
  userAvatar: string = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
  defaultStake: number = 50
): TeenPattiState {
  const deck = generateDeck();
  const shuffledDeck = secureShuffleDeck(deck);

  // Deal 3 cards to Dealer
  const dealerCards: Card[] = [shuffledDeck.pop()!, shuffledDeck.pop()!, shuffledDeck.pop()!];
  const dealerEval = evaluateTeenPattiHand(dealerCards);

  const dealer: TeenPattiDealer = {
    name: 'Dealer',
    cards: dealerCards,
    revealed: false,
    handRankName: dealerEval.rankName
  };

  // Up to 16 total players (1 user + 15 bots)
  const players: TeenPattiPlayer[] = [];

  // Player 0: User
  const userCards: Card[] = [shuffledDeck.pop()!, shuffledDeck.pop()!, shuffledDeck.pop()!];
  const userEval = evaluateTeenPattiHand(userCards);

  players.push({
    id: 'user_me',
    name: userUsername,
    avatar: userAvatar,
    isUser: true,
    cards: userCards,
    seen: false,
    folded: false,
    currentBet: defaultStake,
    handRankName: userEval.rankName
  });

  // Players 1 to 15: Multiplayer bots
  let pot = defaultStake;
  const botBetOptions = [20, 50, 50, 100, 100, 200];

  for (let i = 0; i < 15; i++) {
    const botInfo = BOT_NAMES_AND_AVATARS[i];
    const bCards: Card[] = [shuffledDeck.pop()!, shuffledDeck.pop()!, shuffledDeck.pop()!];
    const bEval = evaluateTeenPattiHand(bCards);
    const botBet = botBetOptions[i % botBetOptions.length];
    pot += botBet;

    players.push({
      id: `bot_${botInfo.name.toLowerCase()}_${i + 1}`,
      name: botInfo.name,
      avatar: botInfo.avatar,
      isUser: false,
      cards: bCards,
      seen: false,
      folded: false,
      currentBet: botBet,
      handRankName: bEval.rankName
    });
  }

  const now = Date.now();
  const roundId = 'TP-' + Math.floor(1000 + Math.random() * 9000);

  return {
    roundId,
    phase: 'betting',
    pot,
    currentStake: defaultStake,
    activePlayerIndex: 0,
    players,
    dealer,
    dealerCards: maskDealerCards(dealerCards),
    dealerRevealed: false,
    winnerId: null,
    countdown: BETTING_DURATION_SEC,
    startedAt: now,
    bettingEndsAt: now + BETTING_DURATION_SEC * 1000,
    phaseEndsAt: now + BETTING_DURATION_SEC * 1000,
    serverTime: now,
    recentWinners: [
      { name: 'Vikram', amount: 1250, hand: 'Pure Sequence' },
      { name: 'LuckyBrix', amount: 2500, hand: 'Trail / Trio' },
      { name: 'Ananya', amount: 800, hand: 'Color / Flush' }
    ]
  };
}

// -------------------------------------------------------------
// 9. STATE SANITIZER (Prevents early card leakage)
// -------------------------------------------------------------
export function sanitizeTeenPattiState(state: TeenPattiState): TeenPattiState {
  const isDealerHidden = state.phase === 'betting' || state.phase === 'lock' || state.phase === 'deal';

  const sanitizedDealer = state.dealer
    ? {
        ...state.dealer,
        cards: isDealerHidden ? maskDealerCards(state.dealer.cards) : state.dealer.cards,
        revealed: !isDealerHidden,
        handRankName: isDealerHidden ? undefined : state.dealer.handRankName
      }
    : undefined;

  const sanitizedPlayers = state.players.map((p) => {
    // User can see their own cards once dealt; others are masked unless showdown/settled
    if (p.isUser) {
      return p;
    }
    if (state.phase === 'compare' || state.phase === 'settlement' || state.phase === 'result' || state.phase === 'completed') {
      return p;
    }
    return {
      ...p,
      cards: maskDealerCards(p.cards)
    };
  });

  return {
    ...state,
    serverTime: Date.now(),
    dealer: sanitizedDealer,
    dealerCards: sanitizedDealer?.cards,
    dealerRevealed: !isDealerHidden,
    dealerHandRank: isDealerHidden ? undefined : state.dealer?.handRankName,
    players: sanitizedPlayers
  };
}

