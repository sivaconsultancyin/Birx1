import 'dotenv/config';
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
} from '../../src/types.ts';

// Environment credentials
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
    cachedAdminClient = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cachedAdminClient;
}

export function getSupabasePublic(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!cachedPublicClient) {
    if (!SUPABASE_ANON_KEY) return null;
    cachedPublicClient = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  }
  return cachedPublicClient;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  return {
    isConfigured,
    supabaseUrl: SUPABASE_URL ? SUPABASE_URL.replace(/(https?:\/\/[^/]+).*/, '$1') : 'Not Configured (Demo/Local Sandbox Mode)',
    hasAnonKey: Boolean(SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your-')),
    hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_SERVICE_ROLE_KEY.includes('your-')),
    hasDatabaseUrl: false,
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
const supabaseRepoImpl = {
  async checkConnectivity(): Promise<{ configured: boolean; reachable: boolean }> {
    const admin = getSupabaseAdmin();
    if (!admin) return { configured: false, reachable: false };
    const { error } = await admin.from('users').select('id').limit(1);
    return { configured: true, reachable: !error };
  },
  // USER QUERIES
  async getUserByAuthId(authUserId: string): Promise<User | null> {
    const admin = getSupabaseAdmin();
    if (!admin || !authUserId) return null;
    const { data, error } = await admin.from('users').select('*').eq('auth_user_id', authUserId).single();
    if (error || !data) return null;
    return {
      id: data.id, email: data.email, mobile: data.mobile, username: data.username,
      role: data.role as UserRole, parentId: data.parent_id, vipTier: data.vip_tier,
      avatarUrl: data.avatar_url, isDemo: data.is_demo, createdAt: data.created_at
    };
  },

  async getUserAndWalletByAuthId(authUserId: string): Promise<{ user: User; wallet: Wallet } | null> {
    const admin = getSupabaseAdmin();
    if (!admin || !authUserId) return null;

    // One PostgREST request instead of separate user + wallet round trips.
    const { data, error } = await admin
      .from('users')
      .select('*, wallets(*)')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error || !data) return null;

    const walletRow = Array.isArray((data as any).wallets)
      ? (data as any).wallets[0]
      : (data as any).wallets;

    if (!walletRow) return null;

    const user: User = {
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

    const wallet: Wallet = {
      balance: Number(walletRow.balance),
      bonus: Number(walletRow.bonus),
      lockedAmount: Number(walletRow.locked_amount || 0),
      currency: walletRow.currency,
      isDemo: walletRow.is_demo
    };

    return { user, wallet };
  },

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

    if (process.env.NODE_ENV !== 'production') {
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

    const sourceUsers = allUsers.length > 0 ? allUsers : (process.env.NODE_ENV === 'production' ? [] : Array.from(dbStore.users.values()));

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
        p_idempotency_key: idempotencyKey || null,
        p_reference_id: `REF-${crypto.randomUUID()}`
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
    const cacheKey = idempotencyKey ?? '';
    if (cacheKey.length > 0) {
      dbStore.idempotency.set(cacheKey, result);
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
        p_idempotency_key: idempotencyKey || null,
        p_reference_id: `REF-${crypto.randomUUID()}`
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
      dbStore.idempotency.set(String(idempotencyKey), result);
    }
    return result;
  },

  // COIN RECHARGE
  async createRecharge(userId: string, amount: number, method = 'UPI', idempotencyKey?: string): Promise<CoinRecharge> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const user = await this.getUserById(userId);
    const key = idempotencyKey?.trim();
    if (key) {
      const { data: existing } = await admin.from('coin_recharges').select('*').eq('idempotency_key', key).maybeSingle();
      if (existing) return {
        id: existing.id, userId: existing.user_id, username: (await this.getUserById(existing.user_id))?.username || 'Player',
        amount: Number(existing.amount), method: existing.method, status: existing.status,
        approvedBy: existing.approved_by, transactionId: existing.transaction_id, createdAt: existing.created_at
      };
    }
    const id = `rch_${crypto.randomUUID()}`;
    const { data, error } = await admin.from('coin_recharges').insert({
      id, user_id: userId, amount, method, status: 'pending', ...(key ? { idempotency_key: key } : {})
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

  // AVIATOR ROUND/BET/SETTLEMENT PERSISTENCE
  async atomicPlaceRouletteBets(input: {
    userId: string;
    gameId: 'roulette';
    roundId: string;
    bets: Array<{ type: string; value?: unknown; numbers?: number[]; amount: number }>;
    idempotencyKey: string;
  }) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase admin client unavailable');
    const { data, error } = await admin.rpc('atomic_place_bets', {
      p_user_id: input.userId,
      p_game_id: input.gameId,
      p_round_id: input.roundId,
      p_bets: input.bets,
      p_idempotency_key: input.idempotencyKey
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async recordGameBet(input: { id: string; roundId: string; userId: string; gameId: string; betType: string; betValue?: any; amount: number; multiplier?: number | null; payout?: number | null; status: string; idempotencyKey?: string | null; settledAt?: string | null }) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const row: any = {
      id: input.id, round_id: input.roundId, user_id: input.userId, game_id: input.gameId,
      bet_type: input.betType, bet_value: input.betValue ?? null, amount: input.amount,
      multiplier: input.multiplier ?? null, payout: input.payout ?? null, status: input.status,
      idempotency_key: input.idempotencyKey ?? null, settled_at: input.settledAt ?? null
    };
    const { data, error } = await admin.from('bets').upsert(row, { onConflict: 'id' }).select('*').single();
    if (error || !data) throw new Error(error?.message || 'Failed to persist game bet');
    return data;
  },

  async getRoundBets(roundId: string, gameId: string): Promise<any[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('bets').select('*').eq('round_id', roundId).eq('game_id', gameId).order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async deleteGameBets(betIds: string[]) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    if (!betIds.length) return;
    const { error } = await admin.from('bets').delete().in('id', betIds);
    if (error) throw new Error(error.message);
  },

  async atomicSettleRouletteRound(input: {
    roundId: string;
    resultData: Record<string, unknown>;
    winningBets: Array<{ id: string; userId: string; amount: number; payout: number; multiplier: number }>;
    losingBetIds: string[];
    outcomeSummary: string;
  }) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase admin client unavailable');
    const { data, error } = await admin.rpc('atomic_settle_round', {
      p_game_id: 'roulette',
      p_round_id: input.roundId,
      p_result_data: input.resultData,
      p_winning_bets: input.winningBets,
      p_losing_bet_ids: input.losingBetIds,
      p_outcome_summary: input.outcomeSummary
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async settleGameBet(betId: string, status: 'won' | 'lost', multiplier: number, payout: number) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('bets').update({
      status, multiplier, payout, settled_at: new Date().toISOString()
    }).eq('id', betId).select('*').single();
    if (error || !data) throw new Error(error?.message || 'Failed to settle game bet');
    return data;
  },

  async getPendingRoulettePayouts(limit = 100) {
    const admin = getSupabaseAdmin();
    if (!admin) return [];
    const { data, error } = await admin.from('settlements')
      .select('id, round_id, details')
      .eq('game_id', 'roulette')
      .eq('outcome_summary', 'PAYOUT_PENDING_RETRY')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRouletteHistory(limit = 50) {
    const admin = getSupabaseAdmin();
    if (!admin) return [];
    const { data, error } = await admin
      .from('game_rounds')
      .select('id, result_data, closed_at')
      .eq('game_id', 'roulette')
      .eq('phase', 'settled')
      .order('closed_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({
      roundId: row.id,
      winningNumber: Number(row.result_data?.winningNumber),
      color: row.result_data?.winningColor || 'unknown',
      timestamp: row.closed_at || new Date().toISOString()
    })).filter((r: any) => Number.isInteger(r.winningNumber) && r.winningNumber >= 0 && r.winningNumber <= 36);
  },

  async getSettlementByRound(roundId: string, gameId: string) {
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data, error } = await admin.from('settlements')
      .select('*')
      .eq('round_id', roundId)
      .eq('game_id', gameId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async recordSettlement(input: { id: string; roundId: string; gameId: string; totalBetsCount: number; totalBetAmount: number; totalPayoutAmount: number; netHouseResult: number; outcomeSummary: string; details?: any }) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('settlements').upsert({
      id: input.id, round_id: input.roundId, game_id: input.gameId,
      total_bets_count: input.totalBetsCount, total_bet_amount: input.totalBetAmount,
      total_payout_amount: input.totalPayoutAmount, net_house_result: input.netHouseResult,
      outcome_summary: input.outcomeSummary, details: input.details ?? null,
      status: 'settled', settled_at: new Date().toISOString()
    }, { onConflict: 'id' }).select('*').single();
    if (error || !data) throw new Error(error?.message || 'Failed to persist settlement');
    return data;
  },

  // GAME ROUND PERSISTENCE
  async recordGameRound(roundId: string, gameId: string, phase: string, resultData: any, roundNumber?: number, serverSeedHash?: string | null) {
    const now = new Date().toISOString();
    dbStore.gameRounds.set(roundId, { id: roundId, gameId, phase, resultData, updatedAt: now });
    const admin = getSupabaseAdmin();
    if (admin) {
      const roundRow: any = {
        id: roundId, game_id: gameId, round_number: Number(roundNumber ?? Date.now()), phase,
        result_data: resultData ?? null,
        started_at: resultData?.startedAt || now,
        closed_at: ['closed','result','settled'].includes(phase) ? now : null,
        settled_at: phase === 'settled' ? now : null
      };
      // Preserve an existing fairness hash when later lifecycle updates do not
      // supply one; never overwrite it with NULL.
      if (serverSeedHash !== undefined) roundRow.server_seed_hash = serverSeedHash;
      const { error } = await admin.from('game_rounds').upsert(roundRow, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }
  },

  async getActiveGameRounds(): Promise<any[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('game_rounds').select('*').in('phase', ['betting','closed','spinning','dealing','in_flight','result']).order('created_at',{ascending:false});
    if (error) throw new Error(error.message);
    return data || [];
  },

  async saveAuthoritativeGameState(gameId: string, state: any): Promise<void> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const suppliedVersion = Number(state?.version);
    const version = Number.isFinite(suppliedVersion) && suppliedVersion > 0 ? suppliedVersion : 1;
    const nextState = { ...state, version };
    const { error } = await admin.from('authoritative_game_states').upsert({
      game_id: gameId,
      round_id: nextState.roundId,
      phase: nextState.phase,
      state: nextState,
      version,
      updated_at: new Date().toISOString()
    }, { onConflict: 'game_id' });
    if (error) throw new Error(error.message);
  },

  async subscribeToAuthoritativeGameStates(onChange: (payload: any) => void): Promise<(() => void) | null> {
    const admin = getSupabaseAdmin();
    if (!admin) return null;

    const channel = admin
      .channel('authoritative-game-states-server')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'authoritative_game_states' },
        (payload) => onChange(payload)
      );

    const cleanup = () => { void admin.removeChannel(channel); };

    // Do not report the HTTP server as ready until the DB realtime listener
    // has actually subscribed. Otherwise the first authoritative DB update can
    // race channel startup and be missed by every WebSocket client.
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Timed out subscribing to authoritative_game_states realtime channel'));
      }, 10000);

      channel.subscribe((status: string, error?: unknown) => {
        if (status === 'SUBSCRIBED') {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          cleanup();
          reject(error instanceof Error ? error : new Error(`Supabase realtime channel status: ${status}`));
        }
      });
    });

    return cleanup;
  },

  async getAuthoritativeGameState(gameId: string): Promise<any | null> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');
    const { data, error } = await admin.from('authoritative_game_states').select('state, version').eq('game_id', gameId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { ...(data.state || {}), version: Number(data.version || data.state?.version || 0) };
  },

  async claimGameLease(gameId: string, ownerId: string, leaseMs = 10000): Promise<boolean> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');

    // Lease expiry is calculated by PostgreSQL, not the application host clock.
    // This prevents short leases from expiring immediately when the Node host clock
    // differs from the database clock or when the request has network latency.
    const { data, error } = await admin.rpc('claim_game_lease', {
      p_game_id: gameId,
      p_owner_id: ownerId,
      p_lease_ms: Math.max(1000, Math.floor(leaseMs))
    });
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

export const supabaseRepo = supabaseRepoImpl;
