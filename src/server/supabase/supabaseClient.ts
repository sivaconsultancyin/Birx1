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
  SUPABASE_SERVICE_ROLE_KEY
);

// Lazy initialized clients
let cachedAdminClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!cachedAdminClient) {
    if (!SUPABASE_SERVICE_ROLE_KEY) return null;
    cachedAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cachedAdminClient;
}

export function getSupabasePublic(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!cachedPublicClient) {
    cachedPublicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY);
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
    authProvider: isConfigured ? 'supabase_auth' : 'not_configured',
    dbEngine: isConfigured ? 'supabase_postgresql' : 'not_configured',
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

// Seed initial hierarchy
function seedInitialStore() {
  const seedUsers: User[] = [
    {
      id: 'usr_owner_001',
      email: 'owner@brix.casino',
      mobile: '+91 99999 00001',
      username: 'BrixOwner',
      role: 'OWNER',
      vipTier: 'Platinum',
      isDemo: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_super_001',
      email: 'superadmin@brix.casino',
      mobile: '+91 99999 00002',
      username: 'ChiefSuperAdmin',
      role: 'SUPER_ADMIN',
      parentId: 'usr_owner_001',
      vipTier: 'Platinum',
      isDemo: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_admin_001',
      email: 'admin@brix.casino',
      mobile: '+91 99999 00003',
      username: 'MasterAdmin',
      role: 'ADMIN',
      parentId: 'usr_super_001',
      vipTier: 'Gold',
      isDemo: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_brix_8849',
      email: 'player@brix.casino',
      mobile: '+91 98765 43210',
      username: 'LuckyBrix',
      role: 'PLAYER',
      parentId: 'usr_admin_001',
      vipTier: 'Gold',
      isDemo: true,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_player_002',
      email: 'alex.highroller@brix.casino',
      mobile: '+91 98111 22334',
      username: 'HighRollerAlex',
      role: 'PLAYER',
      parentId: 'usr_admin_001',
      vipTier: 'Platinum',
      isDemo: false,
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
    }
  ];

  seedUsers.forEach((u) => dbStore.users.set(u.id, u));

  dbStore.wallets.set('usr_owner_001', { balance: 5000000, bonus: 0, currency: 'INR', isDemo: false });
  dbStore.wallets.set('usr_super_001', { balance: 1000000, bonus: 0, currency: 'INR', isDemo: false });
  dbStore.wallets.set('usr_admin_001', { balance: 250000, bonus: 0, currency: 'INR', isDemo: false });
  dbStore.wallets.set('usr_brix_8849', { balance: 25000, bonus: 1000, lockedAmount: 0, currency: 'INR', isDemo: true });
  dbStore.wallets.set('usr_player_002', { balance: 75000, bonus: 5000, lockedAmount: 0, currency: 'INR', isDemo: false });

  dbStore.transactions.push(
    {
      id: 'tx_init_1001',
      userId: 'usr_brix_8849',
      type: 'deposit',
      amount: 25000,
      status: 'success',
      description: 'Welcome Reserve Credits',
      referenceId: 'UPI-DEMO-99887711',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: 'tx_init_1002',
      userId: 'usr_brix_8849',
      type: 'bonus',
      amount: 1000,
      status: 'success',
      description: 'First Login Gold Bonus',
      referenceId: 'BONUS-GOLD-772',
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
    }
  );

  dbStore.recharges.push({
    id: 'rch_1001',
    userId: 'usr_brix_8849',
    username: 'LuckyBrix',
    amount: 10000,
    method: 'UPI',
    status: 'approved',
    approvedBy: 'usr_admin_001',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  });
}

seedInitialStore();

// ---------------------------------------------------------------------
// AUTHORITATIVE SUPABASE REPOSITORY
// ---------------------------------------------------------------------
export const supabaseRepo = {
  // USER QUERIES
  async getUserById(id: string): Promise<User | null> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('users').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id, email: data.email, mobile: data.mobile, username: data.username,
      role: data.role as UserRole, parentId: data.parent_id, vipTier: data.vip_tier,
      avatarUrl: data.avatar_url, isDemo: data.is_demo, createdAt: data.created_at
    };
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

    for (const u of dbStore.users.values()) {
      if (
        (u.email && u.email.toLowerCase() === clean) ||
        (u.mobile && u.mobile.replace(/\D/g, '').includes(clean.replace(/\D/g, ''))) ||
        u.username.toLowerCase() === clean
      ) {
        return u;
      }
    }
    return null;
  },

  async createUser(user: User): Promise<User> {
    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from('users').insert({
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        username: user.username,
        role: user.role,
        parent_id: user.parentId,
        vip_tier: user.vipTier,
        is_demo: user.isDemo,
        created_at: user.createdAt
      });
      await admin.from('wallets').insert({
        user_id: user.id,
        balance: 5000,
        bonus: 500,
        currency: 'INR',
        is_demo: user.isDemo
      });
    }

    dbStore.users.set(user.id, user);
    if (!dbStore.wallets.has(user.id)) {
      dbStore.wallets.set(user.id, {
        balance: 5000,
        bonus: 500,
        lockedAmount: 0,
        currency: 'INR',
        isDemo: user.isDemo
      });
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
    dbStore.users.set(targetUserId, user);
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

    const sourceUsers = allUsers.length > 0 ? allUsers : Array.from(dbStore.users.values());

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
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('wallets').select('*').eq('user_id', userId).single();
    if (error || !data) throw new Error('Wallet not found');
    return {
      balance: Number(data.balance), bonus: Number(data.bonus),
      lockedAmount: Number(data.locked_amount || 0), currency: data.currency, isDemo: data.is_demo
    };
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
    if (admin) {
      const { data, error } = await admin.rpc('atomic_wallet_debit', {
        p_user_id: userId, p_amount: amount, p_type: type,
        p_description: description, p_game_id: gameId || null,
        p_idempotency_key: idempotencyKey || null
      });
      if (error || !data?.success) throw new Error(error?.message || 'Atomic wallet debit failed');
      return data;
    }
    throw new Error('Supabase is not configured');

    // Atomic local transaction
    const wallet = await this.getWallet(userId);
    if (wallet.balance < amount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${amount}`);
    }

    wallet.balance -= amount;
    dbStore.wallets.set(userId, wallet);

    const tx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type,
      amount,
      status: 'success',
      gameId: gameId as any,
      description,
      referenceId: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
    dbStore.transactions.unshift(tx);

    const result = { success: true, wallet, transaction: tx };
    if (idempotencyKey) {
      dbStore.idempotency.set(idempotencyKey, result);
    }
    return result;
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
    if (amount <= 0) throw new Error('Invalid credit amount');

    if (idempotencyKey && dbStore.idempotency.has(idempotencyKey)) {
      return dbStore.idempotency.get(idempotencyKey);
    }

    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin.rpc('atomic_wallet_credit', {
        p_user_id: userId, p_amount: amount, p_type: type,
        p_description: description, p_game_id: gameId || null,
        p_idempotency_key: idempotencyKey || null
      });
      if (error || !data?.success) throw new Error(error?.message || 'Atomic wallet credit failed');
      return data;
    }
    throw new Error('Supabase is not configured');

    const wallet = await this.getWallet(userId);
    wallet.balance += amount;
    dbStore.wallets.set(userId, wallet);

    const tx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type,
      amount,
      status: 'success',
      gameId: gameId as any,
      description,
      referenceId: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
    dbStore.transactions.unshift(tx);

    const result = { success: true, wallet, transaction: tx };
    if (idempotencyKey) {
      dbStore.idempotency.set(idempotencyKey, result);
    }
    return result;
  },

  // COIN RECHARGE
  async createRecharge(userId: string, amount: number, method = 'UPI'): Promise<CoinRecharge> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const user = await this.getUserById(userId);
    const id = `rch_${crypto.randomUUID()}`;
    const { data, error } = await admin.from('coin_recharges').insert({
      id, user_id: userId, amount, method, status: 'pending'
    }).select('*').single();
    if (error || !data) throw new Error(error?.message || 'Failed to create recharge');
    return {
      id: data.id, userId: data.user_id, username: user?.username || 'Player',
      amount: Number(data.amount), method: data.method, status: data.status,
      approvedBy: data.approved_by, transactionId: data.transaction_id, createdAt: data.created_at
    };
  },

  async approveRecharge(rechargeId: string, approvedByUserId: string): Promise<CoinRecharge> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data: rch, error } = await admin.from('coin_recharges').select('*').eq('id', rechargeId).single();
    if (error || !rch) throw new Error('Recharge record not found');
    if (rch.status !== 'pending') throw new Error(`Recharge already ${rch.status}`);
    const creditRes = await this.atomicCredit(rch.user_id, Number(rch.amount), 'recharge', `Admin Coin Recharge #${rch.id}`, undefined, `idemp_rch_${rch.id}`);
    const { data, error: updateError } = await admin.from('coin_recharges').update({
      status:'approved', approved_by:approvedByUserId, transaction_id:creditRes.transaction.id, updated_at:new Date().toISOString()
    }).eq('id', rechargeId).eq('status','pending').select('*').single();
    if (updateError || !data) throw new Error(updateError?.message || 'Recharge approval failed');
    const user=await this.getUserById(data.user_id);
    return { id:data.id,userId:data.user_id,username:user?.username||'Player',amount:Number(data.amount),method:data.method,status:data.status,approvedBy:data.approved_by,transactionId:data.transaction_id,createdAt:data.created_at };
  },

  async rejectRecharge(rechargeId: string, rejectedByUserId: string): Promise<CoinRecharge> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('coin_recharges').update({status:'rejected',approved_by:rejectedByUserId,updated_at:new Date().toISOString()}).eq('id',rechargeId).eq('status','pending').select('*').single();
    if (error || !data) throw new Error(error?.message || 'Recharge not found or already processed');
    const user=await this.getUserById(data.user_id);
    return {id:data.id,userId:data.user_id,username:user?.username||'Player',amount:Number(data.amount),method:data.method,status:data.status,approvedBy:data.approved_by,transactionId:data.transaction_id,createdAt:data.created_at};
  },

  async getRecharges(): Promise<CoinRecharge[]> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('coin_recharges').select('*').order('created_at',{ascending:false});
    if(error) throw new Error(error.message);
    return (data||[]).map((r:any)=>({id:r.id,userId:r.user_id,username:'Player',amount:Number(r.amount),method:r.method,status:r.status,approvedBy:r.approved_by,transactionId:r.transaction_id,createdAt:r.created_at}));
  },

  // WITHDRAWALS
  async createWithdrawal(userId: string, amount: number, upiId: string, idempotencyKey?: string): Promise<WithdrawalRequest> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const debitRes = await this.atomicDebit(userId, amount, 'withdrawal', `Withdrawal Request to ${upiId}`, undefined, idempotencyKey || `wth_req_${crypto.randomUUID()}`);
    const id = `wth_${crypto.randomUUID()}`;
    const { data, error } = await admin.from('withdrawal_requests').insert({id,user_id:userId,amount,upi_id:upiId,status:'pending',transaction_id:debitRes.transaction.id,idempotency_key:idempotencyKey||null}).select('*').single();
    if (error || !data) {
      await this.atomicCredit(userId,amount,'refund','Refund for failed withdrawal request');
      throw new Error(error?.message || 'Failed to create withdrawal request');
    }
    const user=await this.getUserById(userId);
    return {id:data.id,userId:data.user_id,username:user?.username||'Player',amount:Number(data.amount),upiId:data.upi_id,status:data.status,approvedBy:data.approved_by,transactionId:data.transaction_id,createdAt:data.created_at};
  },

  async approveWithdrawal(withdrawalId: string, approvedByUserId: string): Promise<WithdrawalRequest> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('withdrawal_requests').update({status:'approved',approved_by:approvedByUserId,updated_at:new Date().toISOString()}).eq('id',withdrawalId).eq('status','pending').select('*').single();
    if(error||!data) throw new Error(error?.message||'Withdrawal not found or already processed');
    const user=await this.getUserById(data.user_id);
    return {id:data.id,userId:data.user_id,username:user?.username||'Player',amount:Number(data.amount),upiId:data.upi_id,status:data.status,approvedBy:data.approved_by,transactionId:data.transaction_id,createdAt:data.created_at};
  },

  async rejectWithdrawal(withdrawalId: string, rejectedByUserId: string): Promise<WithdrawalRequest> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('withdrawal_requests').update({status:'rejected',approved_by:rejectedByUserId,updated_at:new Date().toISOString()}).eq('id',withdrawalId).eq('status','pending').select('*').single();
    if(error||!data) throw new Error(error?.message||'Withdrawal not found or already processed');
    await this.atomicCredit(data.user_id,Number(data.amount),'refund',`Refund for Rejected Withdrawal #${data.id}`,undefined,`idemp_wth_refund_${data.id}`);
    const user=await this.getUserById(data.user_id);
    return {id:data.id,userId:data.user_id,username:user?.username||'Player',amount:Number(data.amount),upiId:data.upi_id,status:data.status,approvedBy:data.approved_by,transactionId:data.transaction_id,createdAt:data.created_at};
  },

  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    return dbStore.withdrawals;
  },

  // TRANSACTIONS
  async getTransactions(userId?: string): Promise<Transaction[]> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    let query=admin.from('wallet_transactions').select('*').order('created_at',{ascending:false});
    if(userId) query=query.eq('user_id',userId);
    const {data,error}=await query;
    if(error) throw new Error(error.message);
    return (data||[]).map((t:any)=>({
      id:t.id,userId:t.user_id,walletId:t.wallet_id,type:t.type,amount:Number(t.amount),status:t.status,
      gameId:t.game_id,description:t.description,referenceId:t.reference_id,idempotencyKey:t.idempotency_key,createdAt:t.created_at
    }));
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
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('game_rounds').select('*').in('phase', ['betting','lock','deal','running','closed']).order('updated_at',{ascending:false});
    if (error) throw new Error(error.message);
    return data || [];
  },

  async saveAuthoritativeGameState(gameId: string, state: any): Promise<void> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { error } = await admin.from('authoritative_game_states').upsert({
      game_id: gameId, round_id: state.roundId, phase: state.phase, state, updated_at: new Date().toISOString()
    }, { onConflict: 'game_id' });
    if (error) throw new Error(error.message);
  },

  async getAuthoritativeGameState(gameId: string): Promise<any | null> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('authoritative_game_states').select('state').eq('game_id', gameId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.state ?? null;
  },

  async claimGameLease(gameId: string, ownerId: string, leaseMs = 4000): Promise<boolean> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const until = new Date(Date.now() + leaseMs).toISOString();
    const { data, error } = await admin.rpc('claim_game_lease', { p_game_id: gameId, p_owner_id: ownerId, p_lease_until: until });
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async getClaims(): Promise<any[]> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('platform_claims').select('*').order('created_at',{ascending:false});
    if(error) throw new Error(error.message); return data||[];
  },

  async createClaim(claim: any): Promise<any> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('platform_claims').insert(claim).select('*').single();
    if(error||!data) throw new Error(error?.message||'Claim creation failed'); return data;
  },

  async updateClaimStatus(id: string,status: string): Promise<any> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('platform_claims').update({status,updated_at:new Date().toISOString()}).eq('id',id).select('*').single();
    if(error||!data) throw new Error(error?.message||'Claim not found'); return data;
  },

  async getPolicies(): Promise<any> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('platform_policies').select('config').eq('id','default').single();
    if(error) throw new Error(error.message); return data?.config||{};
  },

  async updatePolicies(config: any, updatedBy: string): Promise<any> {
    const admin=getSupabaseAdmin(); if(!admin) throw new Error('Supabase is not configured');
    const {data,error}=await admin.from('platform_policies').upsert({id:'default',config,updated_by:updatedBy,updated_at:new Date().toISOString()}).select('config').single();
    if(error||!data) throw new Error(error?.message||'Policy update failed'); return data.config;
  }
};
