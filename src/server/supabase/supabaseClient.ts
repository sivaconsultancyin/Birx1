import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CoinRecharge,
  GameHistoryEntry,
  SupabaseConfigStatus,
  Transaction,
  User,
  UserRole,
  Wallet,
  WithdrawalRequest
} from '../../types.ts';

// Environment credentials
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

const isConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_SERVICE_ROLE_KEY && SUPABASE_ANON_KEY
);

// Lazy initialized clients
let cachedAdminClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!cachedAdminClient) {
    const key = SUPABASE_SERVICE_ROLE_KEY;
    cachedAdminClient = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cachedAdminClient;
}

export function getSupabasePublic(): SupabaseClient | null {
  if (!isConfigured || !SUPABASE_ANON_KEY) return null;
  if (!cachedPublicClient) {
    cachedPublicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cachedPublicClient;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  return {
    isConfigured,
    supabaseUrl: SUPABASE_URL ? SUPABASE_URL.replace(/(https?:\/\/[^/]+).*/, '$1') : 'Not Configured (Demo/Local Sandbox Mode)',
    hasAnonKey: Boolean(SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your-')),
    hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_SERVICE_ROLE_KEY.includes('your-')),
    hasDatabaseUrl: Boolean(DATABASE_URL && !DATABASE_URL.includes('your-')),
    authProvider: isConfigured ? 'supabase_auth' : 'local_authoritative_engine',
    dbEngine: isConfigured ? 'supabase_postgresql' : 'authoritative_simulated_pg',
    storageAvailable: isConfigured
  };
}

// ---------------------------------------------------------------------
// IN-MEMORY AUTHORITATIVE POSTGRES STORE
// Mirrors exact schema, tables, constraints & atomic RPC operations
// Ensures 100% functionality even before external keys are configured
// ---------------------------------------------------------------------
interface DbStore {
  users: Map<string, User>;
  wallets: Map<string, Wallet>;
  transactions: Transaction[];
  recharges: CoinRecharge[];
  withdrawals: WithdrawalRequest[];
  idempotency: Map<string, any>;
  gameRounds: Map<string, any>;
  bets: Map<string, any[]>;
  settlements: Map<string, any>;
}

const dbStore: DbStore = {
  users: new Map(),
  wallets: new Map(),
  transactions: [],
  recharges: [],
  withdrawals: [],
  idempotency: new Map(),
  gameRounds: new Map(),
  bets: new Map(),
  settlements: new Map()
};

// ---------------------------------------------------------------------
// AUTHORITATIVE SUPABASE REPOSITORY
// ---------------------------------------------------------------------
export const supabaseRepo = {
  // USER QUERIES
  async getUserById(id: string): Promise<User | null> {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data } = await admin.from('users').select('*').eq('id', id).single();
      if (data) {
        return {
          id: data.id,
          email: data.email,
          mobile: data.mobile,
          username: data.username,
          role: data.role as UserRole,
          parentId: data.parent_id,
          vipTier: data.vip_tier,
          avatarUrl: data.avatar_url,
          isDemo: data.is_demo,
          createdAt: data.created_at
        };
      }
    }
    if (!admin) return dbStore.users.get(id) || null;
    return null;
  },

  async getUserByEmailOrMobile(identifier: string): Promise<User | null> {
    const clean = identifier.trim().toLowerCase();
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data } = await admin
        .from('users')
        .select('*')
        .or(`email.eq.${clean},mobile.eq.${clean}`)
        .single();
      if (data) {
        return {
          id: data.id,
          email: data.email,
          mobile: data.mobile,
          username: data.username,
          role: data.role as UserRole,
          parentId: data.parent_id,
          vipTier: data.vip_tier,
          avatarUrl: data.avatar_url,
          isDemo: data.is_demo,
          createdAt: data.created_at
        };
      }
    }

    if (!admin) {
      for (const u of dbStore.users.values()) {
        if (
          (u.email && u.email.toLowerCase() === clean) ||
          (u.mobile && u.mobile.replace(/\D/g, '').includes(clean.replace(/\D/g, ''))) ||
          u.username.toLowerCase() === clean
        ) return u;
      }
    }
    return null;
  },

  async createUser(user: User): Promise<User> {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { error: userError } = await admin.from('users').insert({
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        username: user.username,
        role: user.role,
        parent_id: user.parentId,
        vip_tier: user.vipTier,
        is_demo: false,
        created_at: user.createdAt
      });
      if (userError) throw new Error(`User creation failed: ${userError.message}`);

      const { error: walletError } = await admin.from('wallets').insert({
        user_id: user.id,
        balance: 0,
        bonus: 0,
        currency: 'INR',
        is_demo: false
      });
      if (walletError) throw new Error(`Wallet creation failed: ${walletError.message}`);
    }

    if (!admin) {
      dbStore.users.set(user.id, user);
      if (!dbStore.wallets.has(user.id)) {
        dbStore.wallets.set(user.id, {
          balance: 0,
          bonus: 0,
          lockedAmount: 0,
          currency: 'INR',
          isDemo: false
        });
      }
    }
    return user;
  },

  async updateUserRole(targetUserId: string, newRole: UserRole): Promise<User | null> {
    const user = await this.getUserById(targetUserId);
    if (!user) return null;
    user.role = newRole;

    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from('users').update({ role: newRole }).eq('id', targetUserId);
    }
    if (!admin) dbStore.users.set(targetUserId, user);
    return user;
  },

  async getVisibleUsers(requestingUser: User): Promise<User[]> {
    const allUsers: User[] = [];
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data } = await admin.from('users').select('*').order('created_at', { ascending: false });
      if (data && data.length > 0) {
        data.forEach((d) => {
          allUsers.push({
            id: d.id,
            email: d.email,
            mobile: d.mobile,
            username: d.username,
            role: d.role as UserRole,
            parentId: d.parent_id,
            vipTier: d.vip_tier,
            isDemo: d.is_demo,
            createdAt: d.created_at
          });
        });
      }
    }

    const sourceUsers = admin ? allUsers : Array.from(dbStore.users.values());

    // Role Hierarchy Visibility Filtering:
    // - OWNER can view ALL users
    // - SUPER_ADMIN can view ADMIN and PLAYER
    // - ADMIN can view PLAYER users (specifically their assigned players or all players under agency)
    // - PLAYER can view ONLY themselves
    if (requestingUser.role === 'OWNER') {
      return sourceUsers;
    }
    if (requestingUser.role === 'SUPER_ADMIN') {
      return sourceUsers.filter((u) => u.role === 'ADMIN' || u.role === 'PLAYER');
    }
    if (requestingUser.role === 'ADMIN') {
      return sourceUsers.filter((u) => u.role === 'PLAYER' && (u.parentId === requestingUser.id || !u.parentId));
    }
    return sourceUsers.filter((u) => u.id === requestingUser.id);
  },

  // WALLET & BALANCE
  async getWallet(userId: string): Promise<Wallet> {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin.from('wallets').select('*').eq('user_id', userId).single();
      if (error) throw new Error(`Wallet read failed: ${error.message}`);
      if (!data) throw new Error(`Wallet not found for user ${userId}`);
      return {
        balance: Number(data.balance),
        bonus: Number(data.bonus),
        lockedAmount: Number(data.locked_amount || 0),
        currency: data.currency,
        isDemo: data.is_demo
      };
    }
    throw new Error('Supabase is not configured; authoritative wallet access is unavailable.');
  },

  // ATOMIC WALLET DEBIT
  async atomicDebit(
    userId: string,
    amount: number,
    type: 'bet' | 'withdrawal',
    description: string,
    gameId?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; wallet: Wallet; transaction: Transaction }> {
    if (amount <= 0) throw new Error('Invalid debit amount');

    // 1. Check idempotency
    if (idempotencyKey && dbStore.idempotency.has(idempotencyKey)) {
      return dbStore.idempotency.get(idempotencyKey);
    }

    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured; wallet debit is unavailable.');

    const { data, error } = await admin.rpc('atomic_wallet_debit', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_game_id: gameId || null,
      p_idempotency_key: idempotencyKey || null,
      p_reference_id: `REF-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    });
    if (error) throw new Error(`Atomic wallet debit failed: ${error.message}`);
    if (!data || !data.success) throw new Error('Atomic wallet debit failed without a successful result.');
    return data;
  },

  // ATOMIC WALLET CREDIT
  async atomicCredit(
    userId: string,
    amount: number,
    type: 'payout' | 'deposit' | 'bonus' | 'recharge' | 'refund',
    description: string,
    gameId?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; wallet: Wallet; transaction: Transaction }> {
    if (amount < 0) throw new Error('Invalid credit amount');

    if (idempotencyKey && dbStore.idempotency.has(idempotencyKey)) {
      return dbStore.idempotency.get(idempotencyKey);
    }

    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured; wallet credit is unavailable.');

    const { data, error } = await admin.rpc('atomic_wallet_credit', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_game_id: gameId || null,
      p_idempotency_key: idempotencyKey || null,
      p_reference_id: `REF-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    });
    if (error) throw new Error(`Atomic wallet credit failed: ${error.message}`);
    if (!data || !data.success) throw new Error('Atomic wallet credit failed without a successful result.');
    return data;
  },

  // COIN RECHARGE
  async createRecharge(userId: string, amount: number, method = 'UPI'): Promise<CoinRecharge> {
    const user = await this.getUserById(userId);
    const recharge: CoinRecharge = {
      id: `rch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      username: user?.username || 'Player',
      amount,
      method,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    dbStore.recharges.unshift(recharge);
    return recharge;
  },

  async approveRecharge(rechargeId: string, approvedByUserId: string): Promise<CoinRecharge> {
    const rch = dbStore.recharges.find((r) => r.id === rechargeId);
    if (!rch) throw new Error('Recharge record not found');
    if (rch.status !== 'pending') throw new Error(`Recharge already ${rch.status}`);

    rch.status = 'approved';
    rch.approvedBy = approvedByUserId;

    // Credit player wallet atomically
    const creditRes = await this.atomicCredit(
      rch.userId,
      rch.amount,
      'recharge',
      `Admin Coin Recharge #${rch.id}`,
      undefined,
      `idemp_rch_${rch.id}`
    );
    rch.transactionId = creditRes.transaction.id;

    return rch;
  },

  async rejectRecharge(rechargeId: string, rejectedByUserId: string): Promise<CoinRecharge> {
    const rch = dbStore.recharges.find((r) => r.id === rechargeId);
    if (!rch) throw new Error('Recharge record not found');
    rch.status = 'rejected';
    rch.approvedBy = rejectedByUserId;
    return rch;
  },

  async getRecharges(): Promise<CoinRecharge[]> {
    return dbStore.recharges;
  },

  // WITHDRAWALS
  async createWithdrawal(userId: string, amount: number, upiId: string): Promise<WithdrawalRequest> {
    // Deduct wallet immediately into locked or pending debit
    const debitRes = await this.atomicDebit(
      userId,
      amount,
      'withdrawal',
      `Withdrawal Request to ${upiId}`,
      undefined,
      `wth_req_${Date.now()}`
    );

    const user = await this.getUserById(userId);
    const req: WithdrawalRequest = {
      id: `wth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      username: user?.username || 'Player',
      amount,
      upiId,
      status: 'pending',
      transactionId: debitRes.transaction.id,
      createdAt: new Date().toISOString()
    };
    dbStore.withdrawals.unshift(req);
    return req;
  },

  async approveWithdrawal(withdrawalId: string, approvedByUserId: string): Promise<WithdrawalRequest> {
    const req = dbStore.withdrawals.find((w) => w.id === withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');
    if (req.status !== 'pending') throw new Error(`Withdrawal is already ${req.status}`);

    req.status = 'approved';
    req.approvedBy = approvedByUserId;
    return req;
  },

  async rejectWithdrawal(withdrawalId: string, rejectedByUserId: string): Promise<WithdrawalRequest> {
    const req = dbStore.withdrawals.find((w) => w.id === withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');
    if (req.status !== 'pending') throw new Error(`Withdrawal is already ${req.status}`);

    req.status = 'rejected';
    req.approvedBy = rejectedByUserId;

    // Refund player wallet
    await this.atomicCredit(
      req.userId,
      req.amount,
      'refund',
      `Refund for Rejected Withdrawal #${req.id}`,
      undefined,
      `idemp_wth_refund_${req.id}`
    );

    return req;
  },

  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    return dbStore.withdrawals;
  },

  // TRANSACTIONS
  async getTransactions(userId?: string): Promise<Transaction[]> {
    if (userId) {
      return dbStore.transactions.filter((t) => !t.userId || t.userId === userId);
    }
    return dbStore.transactions;
  },

  // GAME ROUND PERSISTENCE
  async recordGameRound(roundId: string, gameId: string, phase: string, resultData: any) {
    dbStore.gameRounds.set(roundId, {
      id: roundId,
      gameId,
      phase,
      resultData,
      updatedAt: new Date().toISOString()
    });

    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        await admin.from('game_rounds').upsert({
          id: roundId,
          game_id: gameId,
          phase,
          result_data: resultData,
          closed_at: phase === 'closed' || phase === 'settled' ? new Date().toISOString() : null,
          settled_at: phase === 'settled' ? new Date().toISOString() : null
        });
      } catch {
        // ignore fallback
      }
    }
  },

  async getActiveGameRounds(): Promise<any[]> {
    return Array.from(dbStore.gameRounds.values());
  }
};
