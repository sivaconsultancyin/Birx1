// Shared TypeScript types for Brix Games platform

export type GameId = 'roulette' | 'teen-patti' | 'aviator' | 'dice' | 'dragon-tiger' | 'andar-bahar';

export type UserRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'PLAYER';

export type NavigationTab = 'home' | 'games' | 'wallet' | 'history' | 'profile' | 'admin_users' | 'admin_recharge' | 'admin_rounds' | 'admin_status';

export interface User {
  id: string;
  email?: string;
  mobile: string;
  username: string;
  role: UserRole;
  parentId?: string | null;
  avatarUrl?: string;
  avatar?: string;
  maskedPhone?: string;
  isDemo: boolean;
  vipTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  createdAt: string;
}

export interface Wallet {
  balance: number;
  bonus: number;
  currency?: string;
  lockedAmount?: number;
  isDemo: boolean;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'bet' | 'payout' | 'bonus' | 'refund' | 'recharge';
export type TransactionStatus = 'pending' | 'success' | 'failed' | 'rejected';

export interface Transaction {
  id: string;
  userId?: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  gameId?: GameId;
  description: string;
  createdAt: string;
  referenceId: string;
  idempotencyKey?: string;
}

export interface CoinRecharge {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  transactionId?: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  upiId?: string;
  bankDetails?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  transactionId?: string;
  createdAt: string;
}

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  supabaseUrl: string;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasDatabaseUrl: boolean;
  authProvider: 'supabase_auth' | 'local_authoritative_engine';
  dbEngine: 'supabase_postgresql' | 'authoritative_simulated_pg';
  storageAvailable: boolean;
}

export interface GameHistoryEntry {
  id: string;
  gameId: GameId;
  gameName: string;
  betAmount: number;
  winAmount: number;
  netProfit?: number;
  outcome: string;
  multiplier: number;
  settlementStatus: 'settled' | 'pending' | 'refunded';
  createdAt: string;
}

export type GameHistoryRecord = GameHistoryEntry;


// -------------------------------------------------------------
// ROULETTE TYPES
// -------------------------------------------------------------
export type RouletteBetType =
  | 'straight'
  | 'number'
  | 'split'
  | 'street'
  | 'corner'
  | 'sixline'
  | 'dozen1' // 1-12
  | 'dozen2' // 13-24
  | 'dozen3' // 25-36
  | 'col1'   // Column 1 (1, 4, 7, ..., 34)
  | 'col2'   // Column 2 (2, 5, 8, ..., 35)
  | 'col3'   // Column 3 (3, 6, 9, ..., 36)
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'    // 1-18
  | 'high';  // 19-36

export interface RouletteBet {
  id?: string;
  type: RouletteBetType;
  value?: number; // for straight up number 0-36
  numbers?: number[]; // for split, street, corner, sixline
  amount: number;
  label?: string;
}

export type RoulettePhase = 'betting' | 'closed' | 'spinning' | 'result' | 'settled';

export interface RouletteState {
  roundId: string;
  phase: RoulettePhase;
  countdown: number;
  winningNumber: number | null;
  winningColor: 'red' | 'black' | 'green' | null;
  winningCategory?: string;
  recentResults: number[];
  serverSeedHash?: string;
  minimumBet?: number;
  maximumBet?: number;
  maximumExposure?: number;
}

export interface RouletteSettlementBetResult {
  bet: RouletteBet;
  isWin: boolean;
  payoutMultiplier: number;
  payoutAmount: number;
  profit: number;
}

export interface RouletteSettlement {
  roundId: string;
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  winningCategory: string;
  winningBets: RouletteSettlementBetResult[];
  losingBets: RouletteSettlementBetResult[];
  totalBet: number;
  grossPayout: number;
  netResult: number;
  settlementStatus: 'settled';
  wallet: Wallet;
  recentResults: number[];
}

export interface RouletteRulesInfo {
  game: string;
  pockets: number;
  wheelOrder: number[];
  limits: {
    minimumBet: number;
    maximumBet: number;
    maximumExposure: number;
  };
  payouts: Record<string, { ratio: string; multiplier: number; description: string }>;
  zeroRule: string;
}

export interface RouletteHistoryStats {
  history: {
    roundId: string;
    number: number;
    color: 'red' | 'black' | 'green';
    timestamp: string;
  }[];
  redPercentage: number;
  blackPercentage: number;
  greenPercentage: number;
  oddPercentage: number;
  evenPercentage: number;
  lowPercentage: number;
  highPercentage: number;
  hotNumbers: number[];
  coldNumbers: number[];
}

// -------------------------------------------------------------
// TEEN PATTI TYPES
// -------------------------------------------------------------
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  value: number; // for comparison: A=14, K=13, etc.
}

export type TeenPattiHandRank =
  | 'Trail / Trio'
  | 'Pure Sequence'
  | 'Sequence'
  | 'Color / Flush'
  | 'Pair'
  | 'High Card';

export interface TeenPattiPlayer {
  id: string;
  name: string;
  avatar: string;
  isUser: boolean;
  cards: Card[];
  seen: boolean;
  folded: boolean;
  currentBet: number;
  handRankName?: TeenPattiHandRank;
}

export interface TeenPattiDealer {
  name: string;
  cards: Card[];
  revealed: boolean;
  handRankName?: TeenPattiHandRank;
}

export interface TeenPattiSettlementDetail {
  playerId: string;
  isUser: boolean;
  betAmount: number;
  outcome: 'player_win' | 'dealer_win' | 'tie';
  multiplier: number;
  grossPayout: number;
  netProfit: number;
  playerHandRank: TeenPattiHandRank;
  dealerHandRank: TeenPattiHandRank;
  summaryText: string;
}

export interface TeenPattiState {
  roundId: string;
  phase:
    | 'betting'
    | 'lock'
    | 'deal'
    | 'compare'
    | 'settlement'
    | 'result'
    | 'completed'
    | 'dealing'
    | 'playing'
    | 'showdown'
    | 'settled';
  pot: number;
  currentStake: number;
  activePlayerIndex: number;
  players: TeenPattiPlayer[];
  dealer?: TeenPattiDealer;
  dealerCards?: Card[];
  dealerRevealed?: boolean;
  dealerHandRank?: TeenPattiHandRank;
  winnerId: string | null;
  winnerHand?: string;
  countdown: number;
  startedAt?: number;
  bettingEndsAt?: number;
  phaseEndsAt?: number;
  serverTime?: number;
  recentWinners: { name: string; amount: number; hand: string }[];
  userSettlement?: TeenPattiSettlementDetail;
}

// -------------------------------------------------------------
// AVIATOR TYPES
// -------------------------------------------------------------
export interface AviatorState {
  roundId: string;
  phase: 'betting' | 'running' | 'crashed';
  multiplier: number;
  crashMultiplier: number | null;
  countdown: number;
  previousMultipliers: number[];
}

export interface AviatorBet {
  betId: string;
  amount: number;
  cashedOut: boolean;
  cashOutMultiplier?: number;
  winAmount?: number;
}

// -------------------------------------------------------------
// DICE TYPES
// -------------------------------------------------------------
export type DiceBetType = 'under7' | 'exact7' | 'over7' | 'even' | 'odd' | 'doubles';

export interface DiceState {
  roundId: string;
  phase: 'betting' | 'rolling' | 'settled';
  dice1: number | null;
  dice2: number | null;
  sum: number | null;
  recentSums: number[];
  countdown: number;
}

// -------------------------------------------------------------
// DRAGON TIGER TYPES
// -------------------------------------------------------------
export type DragonTigerBetSide = 'dragon' | 'tiger' | 'tie';

export interface DragonTigerState {
  roundId: string;
  phase: 'betting' | 'dealing' | 'settled';
  dragonCard: Card | null;
  tigerCard: Card | null;
  winner: DragonTigerBetSide | null;
  recentResults: DragonTigerBetSide[];
  countdown: number;
}

// -------------------------------------------------------------
// ANDAR BAHAR TYPES
// -------------------------------------------------------------
export type AndarBaharSide = 'andar' | 'bahar';

export interface AndarBaharDealtCard {
  side: AndarBaharSide;
  card: Card;
}

export interface AndarBaharState {
  roundId: string;
  phase: 'betting' | 'shuffle' | 'dealing' | 'settled';
  jokerCard: Card | null;
  dealtCards: AndarBaharDealtCard[];
  winningSide: AndarBaharSide | null;
  recentWinners: AndarBaharSide[];
  countdown: number;
  phaseEndsAt?: number;
  startedAt?: number;
  userBet?: { side: AndarBaharSide; amount: number };
  userSettlement?: {
    isWin: boolean;
    winAmount: number;
    betAmount: number;
    side: AndarBaharSide;
    multiplier: number;
  };
}

// -------------------------------------------------------------
// REALTIME EVENT TYPES
// -------------------------------------------------------------
export type ServerEventType =
  | 'round_started'
  | 'betting_open'
  | 'betting_closed'
  | 'card_revealed'
  | 'result'
  | 'settlement'
  | 'wallet_updated'
  | 'round_recovered';

export interface RealtimeEventPayload {
  event: ServerEventType;
  gameId?: GameId;
  data: any;
  timestamp: number;
}
