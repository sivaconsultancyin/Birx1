import {
  AndarBaharSide,
  AndarBaharState,
  AviatorBet,
  AviatorState,
  CoinRecharge,
  DiceBetType,
  DiceState,
  DragonTigerBetSide,
  DragonTigerState,
  GameHistoryEntry,
  GameId,
  RealtimeEventPayload,
  RouletteBet,
  RouletteState,
  RouletteRulesInfo,
  RouletteHistoryStats,
  RouletteSettlement,
  SupabaseConfigStatus,
  TeenPattiState,
  Transaction,
  User,
  UserRole,
  Wallet,
  WithdrawalRequest
} from '../types.ts';

const BASE_URL = '/api';

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('brix_token') || 'token_demo';
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-Id': `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error (${response.status})`);
  }

  return response.json();
}

// -------------------------------------------------------------
// AUTH API
// -------------------------------------------------------------
export const authApi = {
  async sendOtp(mobile: string): Promise<{ success: boolean; message: string; demoOtp: string }> {
    return fetchJson('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile })
    });
  },

  async verifyOtp(mobile: string, otp: string): Promise<{ success: boolean; token: string; user: User }> {
    const res = await fetchJson<{ success: boolean; token: string; user: User }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp })
    });
    if (res.token) {
      localStorage.setItem('brix_token', res.token);
    }
    return res;
  },

  async register(mobile: string, otp: string, username: string): Promise<{ success: boolean; token: string; user: User }> {
    const res = await fetchJson<{ success: boolean; token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp, username })
    });
    if (res.token) {
      localStorage.setItem('brix_token', res.token);
    }
    return res;
  },

  async getMe(): Promise<{ user: User; wallet: Wallet }> {
    return fetchJson('/auth/me');
  },

  async switchRole(role: UserRole): Promise<{ success: boolean; user: User; wallet: Wallet; token: string }> {
    const res = await fetchJson<{ success: boolean; user: User; wallet: Wallet; token: string }>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    if (res.token) {
      localStorage.setItem('brix_token', res.token);
    }
    return res;
  },

  async logout(): Promise<{ success: boolean }> {
    localStorage.removeItem('brix_token');
    return fetchJson('/auth/logout', { method: 'POST' });
  }
};

// -------------------------------------------------------------
// ADMIN MANAGEMENT & SUPABASE API
// -------------------------------------------------------------
export const adminApi = {
  async getUsers(): Promise<{ users: User[] }> {
    return fetchJson('/admin/users');
  },

  async createUser(userData: {
    mobile: string;
    username: string;
    role: UserRole;
    email?: string;
  }): Promise<{ success: boolean; user: User }> {
    return fetchJson('/admin/users/create', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUserRole(targetUserId: string, newRole: UserRole): Promise<{ success: boolean; user: User }> {
    return fetchJson(`/admin/users/${targetUserId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole })
    });
  },

  async getRecharges(): Promise<{ recharges: CoinRecharge[] }> {
    return fetchJson('/admin/recharges');
  },

  async approveRecharge(rechargeId: string): Promise<{ success: boolean; recharge: CoinRecharge }> {
    return fetchJson(`/admin/recharges/${rechargeId}/approve`, {
      method: 'POST'
    });
  },

  async rejectRecharge(rechargeId: string): Promise<{ success: boolean; recharge: CoinRecharge }> {
    return fetchJson(`/admin/recharges/${rechargeId}/reject`, {
      method: 'POST'
    });
  },

  async getWithdrawals(): Promise<{ withdrawals: WithdrawalRequest[] }> {
    return fetchJson('/admin/withdrawals');
  },

  async approveWithdrawal(withdrawalId: string): Promise<{ success: boolean; withdrawal: WithdrawalRequest }> {
    return fetchJson(`/admin/withdrawals/${withdrawalId}/approve`, {
      method: 'POST'
    });
  },

  async rejectWithdrawal(withdrawalId: string): Promise<{ success: boolean; withdrawal: WithdrawalRequest }> {
    return fetchJson(`/admin/withdrawals/${withdrawalId}/reject`, {
      method: 'POST'
    });
  },

  async getSupabaseStatus(): Promise<{ status: SupabaseConfigStatus; stats: any }> {
    return fetchJson('/admin/supabase-status');
  },

  async getStorageAssets(): Promise<{ assets: any[] }> {
    return fetchJson('/admin/storage/assets');
  },

  async getClaims(): Promise<{ claims: any[] }> {
    return fetchJson('/admin/claims');
  },

  async createClaim(claimData: {
    type: string;
    subject: string;
    description: string;
    amount?: number;
    gameId?: string;
    documentUrl?: string;
  }): Promise<{ success: boolean; claim: any }> {
    return fetchJson('/admin/claims/create', {
      method: 'POST',
      body: JSON.stringify(claimData)
    });
  },

  async updateClaimStatus(claimId: string, status: string): Promise<{ success: boolean; claim: any }> {
    return fetchJson(`/admin/claims/${claimId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async getPolicies(): Promise<{ policies: any }> {
    return fetchJson('/admin/policies');
  },

  async updatePolicies(policies: any): Promise<{ success: boolean; policies: any }> {
    return fetchJson('/admin/policies/update', {
      method: 'POST',
      body: JSON.stringify(policies)
    });
  }
};

// -------------------------------------------------------------
// STORAGE & DOCUMENTS API
// -------------------------------------------------------------
export const storageApi = {
  async getShuffleVideoInfo(): Promise<{
    bucket: string;
    path: string;
    url: string;
    durationSeconds: number;
    format: string;
    isStorageBacked: boolean;
    configured: boolean;
  }> {
    return fetchJson('/storage/shuffle-video');
  },

  async getDocuments(): Promise<{ documents: any[] }> {
    return fetchJson('/storage/documents');
  },

  async uploadDocument(docData: {
    name: string;
    category: string;
    url?: string;
    size?: number;
    uploadedBy?: string;
  }): Promise<{ success: boolean; document: any }> {
    return fetchJson('/storage/documents/upload', {
      method: 'POST',
      body: JSON.stringify(docData)
    });
  },

  async updateDocumentStatus(docId: string, status: string): Promise<{ success: boolean; document: any }> {
    return fetchJson(`/storage/documents/${docId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }
};

// -------------------------------------------------------------
// WALLET API
// -------------------------------------------------------------
export const walletApi = {
  async getBalance(): Promise<{ wallet: Wallet }> {
    return fetchJson('/wallet/balance');
  },

  async getTransactions(): Promise<{ transactions: Transaction[] }> {
    return fetchJson('/wallet/transactions');
  },

  async deposit(amount: number, method = 'UPI'): Promise<{ success: boolean; wallet: Wallet; transaction: Transaction }> {
    return fetchJson('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        method,
        idempotencyKey: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      })
    });
  },

  async withdraw(amount: number, upiId: string): Promise<{ success: boolean; wallet: Wallet; transaction: Transaction }> {
    return fetchJson('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        upiId,
        idempotencyKey: `wth_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      })
    });
  }
};

// -------------------------------------------------------------
// GAMES API
// -------------------------------------------------------------
export const gamesApi = {
  async getHistory(): Promise<{ history: GameHistoryEntry[] }> {
    return fetchJson('/games/history');
  },

  // 1. Roulette (European Single Zero 0-36)
  roulette: {
    async getRules(): Promise<RouletteRulesInfo> {
      return fetchJson('/games/roulette/rules');
    },
    async getRound(): Promise<{
      state: RouletteState;
      roundId: string;
      phase: RouletteState['phase'];
      countdown: number;
      winningNumber: number | null;
      winningColor: 'red' | 'black' | 'green' | null;
      winningCategory?: string;
      recentResults: number[];
      serverSeedHash?: string;
      limits: { minimumBet: number; maximumBet: number; maximumExposure: number };
    }> {
      return fetchJson('/games/roulette/round');
    },
    async getState(): Promise<{ state: RouletteState }> {
      return fetchJson('/games/roulette/state');
    },
    async getHistory(): Promise<RouletteHistoryStats> {
      return fetchJson('/games/roulette/history');
    },
    async placeBets(bets: RouletteBet[], idempotencyKey?: string): Promise<{
      success: boolean;
      roundId: string;
      bets: RouletteBet[];
      totalBetPlaced: number;
      wallet: Wallet;
      countdown: number;
    }> {
      return fetchJson('/games/roulette/bets', {
        method: 'POST',
        body: JSON.stringify({
          bets,
          idempotencyKey: idempotencyKey || `rl_bet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        })
      });
    },
    async getMyBets(): Promise<{ roundId: string; bets: RouletteBet[]; totalBet: number }> {
      return fetchJson('/games/roulette/bets');
    },
    async getSettlement(roundId: string): Promise<{ settlement: RouletteSettlement }> {
      return fetchJson(`/games/roulette/settlement/${roundId}`);
    },
    async spin(bets: RouletteBet[], idempotencyKey?: string): Promise<RouletteSettlement & { success: boolean; winAmount: number; netProfit: number }> {
      return fetchJson('/games/roulette/spin', {
        method: 'POST',
        body: JSON.stringify({
          bets,
          idempotencyKey: idempotencyKey || `rl_spin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        })
      });
    }
  },

  // 2. Teen Patti
  teenPatti: {
    async getState(): Promise<{ state: TeenPattiState }> {
      return fetchJson('/games/teen-patti/state');
    },
    async placeBet(amount: number): Promise<{ success: boolean; state: TeenPattiState; wallet: Wallet }> {
      return fetchJson('/games/teen-patti/bet', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
    },
    async newRound(bootAmount = 50): Promise<{ success: boolean; state: TeenPattiState; wallet: Wallet }> {
      return fetchJson('/games/teen-patti/new-round', {
        method: 'POST',
        body: JSON.stringify({ bootAmount })
      });
    },
    async action(action: 'see' | 'blind' | 'chaal' | 'fold' | 'show' | 'bet', betAmount?: number): Promise<{
      success: boolean;
      state: TeenPattiState;
      userCards?: any[];
      winner?: any;
      winAmount?: number;
      wallet?: Wallet;
    }> {
      return fetchJson('/games/teen-patti/action', {
        method: 'POST',
        body: JSON.stringify({ action, betAmount })
      });
    }
  },

  // 3. Aviator
  aviator: {
    async getState(): Promise<{ state: AviatorState & { currentBet: AviatorBet | null } }> {
      return fetchJson('/games/aviator/state');
    },
    async placeBet(amount: number): Promise<{ success: boolean; bet: AviatorBet; wallet: Wallet }> {
      return fetchJson('/games/aviator/bet', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
    },
    async cashOut(): Promise<{ success: boolean; cashMultiplier: number; winAmount: number; wallet: Wallet }> {
      return fetchJson('/games/aviator/cashout', {
        method: 'POST'
      });
    }
  },

  // 4. Dice
  dice: {
    async getState(): Promise<{ state: DiceState }> {
      return fetchJson('/games/dice/state');
    },
    async roll(betType: DiceBetType, amount: number): Promise<{
      success: boolean;
      dice1: number;
      dice2: number;
      sum: number;
      isDoubles: boolean;
      multiplier: number;
      winAmount: number;
      wallet: Wallet;
      recentSums: number[];
    }> {
      return fetchJson('/games/dice/roll', {
        method: 'POST',
        body: JSON.stringify({ betType, amount })
      });
    }
  },

  // 5. Dragon Tiger
  dragonTiger: {
    async getState(): Promise<{ state: DragonTigerState }> {
      return fetchJson('/games/dragon-tiger/state');
    },
    async deal(betSide: DragonTigerBetSide, amount: number): Promise<{
      success: boolean;
      dragonCard: any;
      tigerCard: any;
      winner: DragonTigerBetSide;
      multiplier: number;
      winAmount: number;
      wallet: Wallet;
      recentResults: DragonTigerBetSide[];
    }> {
      return fetchJson('/games/dragon-tiger/deal', {
        method: 'POST',
        body: JSON.stringify({ betSide, amount })
      });
    }
  },

  // 6. Andar Bahar
  andarBahar: {
    async getState(): Promise<{ state: AndarBaharState }> {
      return fetchJson('/games/andar-bahar/state');
    },
    async deal(betSide: AndarBaharSide, amount: number): Promise<{
      success: boolean;
      roundId?: string;
      jokerCard: any;
      dealtCards: any[];
      winningSide: AndarBaharSide;
      multiplier: number;
      winAmount: number;
      wallet: Wallet;
      recentWinners: AndarBaharSide[];
      state?: AndarBaharState;
    }> {
      return fetchJson('/games/andar-bahar/deal', {
        method: 'POST',
        body: JSON.stringify({ betSide, amount })
      });
    }
  }
};

// -------------------------------------------------------------
// REALTIME SSE SUBSCRIBER
// -------------------------------------------------------------
export function subscribeToRealtimeEvents(onEvent: (payload: RealtimeEventPayload) => void): () => void {
  try {
    const eventSource = new EventSource('/api/events/stream');

    const handleGenericEvent = (e: MessageEvent, name: string) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent({
          event: name as any,
          data: parsed,
          timestamp: Date.now()
        });
      } catch {
        // ignore parse error
      }
    };

    const eventNames = [
      'round_started',
      'betting_open',
      'betting_closed',
      'card_revealed',
      'result',
      'settlement',
      'wallet_updated',
      'teen_patti_round_started',
      'teen_patti_betting_open',
      'teen_patti_betting_closed',
      'teen_patti_dealing_started',
      'teen_patti_dealer_revealed',
      'teen_patti_result',
      'teen_patti_settlement',
      'teen_patti_bet_placed'
    ];

    eventNames.forEach((evtName) => {
      eventSource.addEventListener(evtName, (e) => handleGenericEvent(e as MessageEvent, evtName));
    });

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const evt = parsed.type || 'message';
        onEvent({
          event: evt as any,
          data: parsed,
          timestamp: Date.now()
        });
      } catch {
        // ignore parse error
      }
    };

    return () => {
      eventSource.close();
    };
  } catch {
    return () => {};
  }
}

export function subscribeToEvents(onEvent: (event: { type: string; data?: any }) => void): () => void {
  return subscribeToRealtimeEvents((payload) => {
    onEvent({
      type: payload.event === 'wallet_updated' ? 'WALLET_UPDATE' : payload.event.toUpperCase(),
      data: payload.data
    });
  });
}

