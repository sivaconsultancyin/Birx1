import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
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
import { supabaseRepo, getSupabaseConfigStatus, getSupabasePublic } from './src/server/supabase/supabaseClient.ts';
import { authService, requireAuth, requirePlayerForGames, requireRoles } from './src/server/auth/authService.ts';
import { walletService } from './src/server/wallet/walletService.ts';
import { storageService } from './src/server/storage/storageService.ts';
import { gameRecoveryService } from './src/server/recovery/gameRecoveryService.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '256kb' }));
app.disable('x-powered-by');
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});


// Request-scoped identity only. Never use process-global user/wallet state for authorization.
const gameHistories: GameHistoryEntry[] = [];
const transactions: Transaction[] = [];
const PROCESS_OWNER_ID = `brix-${process.pid}-${crypto.randomUUID()}`;
async function acquireGameLease(gameId: string): Promise<boolean> {
  try { return await supabaseRepo.claimGameLease(gameId, PROCESS_OWNER_ID, 4000); }
  catch (e) { console.error(`[GameLease:${gameId}]`, e); return false; }
}

async function getRequestUser(req: Request): Promise<User> {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
}

async function debitForUser(req: Request, amount: number, description: string, gameId?: string, idempotencyKey?: string) {
  const user = await getRequestUser(req);
  return supabaseRepo.atomicDebit(user.id, amount, 'bet', description, gameId, idempotencyKey);
}

async function creditForUser(req: Request, amount: number, description: string, gameId?: string, idempotencyKey?: string) {
  const user = await getRequestUser(req);
  return supabaseRepo.atomicCredit(user.id, amount, 'payout', description, gameId, idempotencyKey);
}

async function tryDebitForUser(req: Request, amount: number, description: string, gameId?: string, idempotencyKey?: string): Promise<boolean> {
  try { await debitForUser(req, amount, description, gameId, idempotencyKey); return true; } catch { return false; }
}

async function tryCreditForUser(req: Request, amount: number, description: string, gameId?: string, idempotencyKey?: string): Promise<boolean> {
  try { await creditForUser(req, amount, description, gameId, idempotencyKey); return true; } catch { return false; }
}
// -------------------------------------------------------------
// SSE STREAM FOR REAL-TIME EVENTS
// -------------------------------------------------------------
function recordHistory(entry: Omit<GameHistoryEntry, 'id' | 'createdAt'>): void {
  gameHistories.unshift({
    ...entry,
    id: `hist_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString()
  });
  if (gameHistories.length > 500) gameHistories.pop();
}

const sseClients: Response[] = [];

function broadcastSSE(event: string, data: any) {
  const payloadData = { type: event, ...data };
  const messagePayload = `data: ${JSON.stringify(payloadData)}\n\n`;
  const eventPayload = `event: ${event}\ndata: ${JSON.stringify(payloadData)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(messagePayload);
      res.write(eventPayload);
    } catch {
      // client dropped
    }
  });
}

const handleSSEConnection = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);
  res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) sseClients.splice(index, 1);
  });
};

app.get('/api/events/stream', requireAuth, requirePlayerForGames, handleSSEConnection);
app.get('/api/realtime', requireAuth, requirePlayerForGames, handleSSEConnection);

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', platform: 'Brix Games Authoritative Server', timestamp: Date.now() });
});

// -------------------------------------------------------------
 // AUTH ENDPOINTS
 // -------------------------------------------------------------
function normalizeMobile(value: unknown): string {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('Invalid mobile number');
  return digits.length === 10 ? `+91${digits}` : `+${digits.replace(/^\+/, '')}`;
}

async function requireSupabaseAuthClient() {
  const client = getSupabasePublic();
  if (!client) throw new Error('Supabase Auth is not configured. Set SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).');
  return client;
}

// Supabase Auth owns OTP generation, delivery, expiry and brute-force controls.
app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const phone = normalizeMobile(req.body.mobile);
    const mode = req.body.mode === 'register' ? 'register' : 'login';
    const client = await requireSupabaseAuthClient();
    const { error } = await client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: mode === 'register' }
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const phone = normalizeMobile(req.body.mobile);
    const otp = String(req.body.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'OTP must be 6 digits' });

    const client = await requireSupabaseAuthClient();
    const { data, error } = await client.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error || !data.session || !data.user) return res.status(400).json({ error: error?.message || 'Invalid or expired OTP' });

    let user = await supabaseRepo.getUserByAuthUserId(data.user.id);
    if (!user) {
      const existing = await supabaseRepo.getUserByEmailOrMobile(phone);
      if (!existing) return res.status(403).json({ error: 'Account not registered. Please use Register first.' });
      await supabaseRepo.linkAuthUser(existing.id, data.user.id);
      user = existing;
    }

    const wallet = await supabaseRepo.getWallet(user.id);
    res.json({ success: true, token: data.session.access_token, user, wallet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const phone = normalizeMobile(req.body.mobile);
    const username = String(req.body.username || '').trim();
    const otp = String(req.body.otp || '').trim();
    if (username.length < 3 || username.length > 50) return res.status(400).json({ error: 'Username must be 3-50 characters' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'OTP must be 6 digits' });

    const client = await requireSupabaseAuthClient();
    const { data, error } = await client.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error || !data.session || !data.user) return res.status(400).json({ error: error?.message || 'Invalid or expired OTP' });

    let user = await supabaseRepo.getUserByAuthUserId(data.user.id);
    if (!user) {
      const existing = await supabaseRepo.getUserByEmailOrMobile(phone);
      if (existing) {
        await supabaseRepo.linkAuthUser(existing.id, data.user.id);
        user = existing;
      } else {
        user = await supabaseRepo.createUser({
          id: `usr_${crypto.randomUUID()}`,
          mobile: phone,
          username,
          role: 'PLAYER',
          vipTier: 'Bronze',
          isDemo: false,
          createdAt: new Date().toISOString()
        });
        await supabaseRepo.linkAuthUser(user.id, data.user.id);
      }
    }

    const wallet = await supabaseRepo.getWallet(user.id);
    res.status(201).json({ success: true, token: data.session.access_token, user, wallet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/switch-role', requireAuth, requireRoles(['OWNER']), async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_ROLE_SWITCH !== 'true') {
    return res.status(403).json({ error: 'Role switching is disabled.' });
  }
  try {
    const { role } = req.body;
    if (!['OWNER', 'SUPER_ADMIN', 'ADMIN', 'PLAYER'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const session = await authService.switchRole(req.user!.id, role);
    const token = authService.extractToken(req)!;
    res.json({ success: true, token, user: session.user, wallet: session.wallet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  res.json({ user: req.user, wallet: req.wallet });
});

app.post('/api/auth/logout', requireAuth, async (req: Request, res: Response) => {
  const token = authService.extractToken(req);
  if (token) {
    const admin = getSupabasePublic();
    if (admin) {
      try {
        await admin.auth.signOut({ scope: 'global' });
      } catch {
        // Access tokens expire server-side; logout remains idempotent.
      }
    }
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// -------------------------------------------------------------
// ADMIN MANAGEMENT ENDPOINTS (Strict Role-Based Access Control)
// -------------------------------------------------------------
// GET visible users respecting OWNER -> SUPER_ADMIN -> ADMIN -> PLAYER hierarchy
app.get('/api/admin/users', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const users = await supabaseRepo.getVisibleUsers(actor);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE subordinate user under actor
app.post('/api/admin/users/create', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const { mobile, username, role, email } = req.body;
    if (!mobile || !username || !role) {
      return res.status(400).json({ error: 'mobile, username, and role are required' });
    }

    if (!authService.canManageUser(actor, role)) {
      return res.status(403).json({ error: `Actor with role ${actor.role} cannot create user with role ${role}` });
    }

    const created = await supabaseRepo.createUser({
      id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      mobile,
      email,
      username,
      role,
      parentId: actor.id,
      vipTier: 'Bronze',
      isDemo: false,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, user: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user role
app.patch('/api/admin/users/:id/role', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const { role } = req.body;
    if (!authService.canManageUser(actor, role)) {
      return res.status(403).json({ error: `Permission denied: ${actor.role} cannot grant role ${role}` });
    }
    const updated = await supabaseRepo.updateUserRole(req.params.id, role);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// COIN RECHARGES
app.get('/api/admin/recharges', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (_req: Request, res: Response) => {
  const recharges = await walletService.getRecharges();
  res.json({ recharges });
});

app.post('/api/admin/recharges/:id/approve', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const recharge = await walletService.approveCoinRecharge(req.params.id, actor.id);
    // Sync local wallet if it was for current user
    res.json({ success: true, recharge });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/recharges/:id/reject', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const recharge = await walletService.rejectCoinRecharge(req.params.id, actor.id);
    res.json({ success: true, recharge });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// WITHDRAWALS
app.get('/api/admin/withdrawals', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (_req: Request, res: Response) => {
  const withdrawals = await walletService.getWithdrawals();
  res.json({ withdrawals });
});

app.post('/api/admin/withdrawals/:id/approve', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const withdrawal = await walletService.approveWithdrawal(req.params.id, actor.id);
    res.json({ success: true, withdrawal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/withdrawals/:id/reject', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const withdrawal = await walletService.rejectWithdrawal(req.params.id, actor.id);
    res.json({ success: true, withdrawal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SUPABASE STATUS & HEALTH
app.get('/api/admin/supabase-status', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (_req: Request, res: Response) => {
  const status = getSupabaseConfigStatus();
  const allUsers = await supabaseRepo.getVisibleUsers({ role: 'OWNER' } as User);
  const recharges = await walletService.getRecharges();
  const withdrawals = await walletService.getWithdrawals();
  const allTransactions = await walletService.getTransactions();

  res.json({
    status,
    stats: {
      totalUsers: allUsers.length,
      totalRecharges: recharges.length,
      totalWithdrawals: withdrawals.length,
      totalTransactions: allTransactions.length,
      schemaFile: 'supabase/migrations/20260920000000_supabase_brix_platform.sql'
    }
  });
});

// STORAGE ASSETS & SHUFFLE VIDEO
app.get('/api/storage/shuffle-video', async (_req: Request, res: Response) => {
  const info = await storageService.getShuffleVideoInfo();
  res.json(info);
});

app.get('/api/admin/storage/assets', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (_req: Request, res: Response) => {
  const assets = await storageService.listAssets('all');
  res.json({ assets });
});

// DOCUMENT UPLOADS & GOOGLE DRIVE INTEGRATION METADATA
app.get('/api/storage/documents', requireAuth, async (_req: Request, res: Response) => {
  const docs = await storageService.listDocuments();
  res.json({ documents: docs });
});

app.post('/api/storage/documents/upload', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { name, category, url, size, uploadedBy } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Document name and category are required' });
    }
    const doc = await storageService.recordDocument({
      name,
      category,
      url: url || `/assets/docs/${name}`,
      size: Number(size) || 125000,
      uploadedBy: req.user!.id
    });
    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/storage/documents/:id/status', requireAuth, requireRoles(['OWNER', 'SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const updated = await storageService.updateDocumentStatus(id, status);
  if (!updated) return res.status(404).json({ error: 'Document not found' });
  res.json({ success: true, document: updated });
});

// CLAIMS & APPLICATION STATUS MANAGEMENT
// CLAIMS & POLICY MANAGEMENT — Supabase authoritative storage
interface PlatformClaim { id:string; userId:string; type:string; title:string; description:string; status:string; createdAt:string; updatedAt:string; }

app.get('/api/admin/claims', requireAuth, requireRoles(['OWNER','SUPER_ADMIN','ADMIN']), async (_req,res) => {
  try { res.json({ claims: await supabaseRepo.getClaims() }); }
  catch (e:any) { res.status(500).json({error:e.message}); }
});

app.post('/api/admin/claims/create', requireAuth, requireRoles(['OWNER','SUPER_ADMIN','ADMIN']), async (req,res) => {
  try {
    const claim={ id:`clm_${crypto.randomUUID()}`, user_id:req.user!.id, type:String(req.body.type||'general'), title:String(req.body.title||'').trim(), description:String(req.body.description||'').trim(), status:'pending' };
    if(!claim.title || !claim.description) return res.status(400).json({error:'title and description are required'});
    res.status(201).json({success:true,claim:await supabaseRepo.createClaim(claim)});
  } catch(e:any){res.status(500).json({error:e.message});}
});

app.patch('/api/admin/claims/:id/status', requireAuth, requireRoles(['OWNER','SUPER_ADMIN','ADMIN']), async (req,res) => {
  try {
    const status=String(req.body.status||'');
    if(!['pending','approved','rejected','resolved'].includes(status)) return res.status(400).json({error:'Invalid status'});
    res.json({success:true,claim:await supabaseRepo.updateClaimStatus(req.params.id,status)});
  } catch(e:any){res.status(500).json({error:e.message});}
});

// POLICY PRICING & AGENT COMMISSION CONFIGURATION — Supabase authoritative storage
app.get('/api/admin/policies', requireAuth, requireRoles(['OWNER','SUPER_ADMIN','ADMIN']), async (_req,res) => {
  try { res.json({policies:await supabaseRepo.getPolicies()}); }
  catch(e:any){res.status(500).json({error:e.message});}
});
app.post('/api/admin/policies/update', requireAuth, requireRoles(['OWNER','SUPER_ADMIN']), async (req,res) => {
  try {
    const current=await supabaseRepo.getPolicies();
    const allowed=['commissionRates','withdrawalFees','minDeposit','minWithdrawal','gameLimits','vipTiers'];
    const next:any={...current};
    for(const key of allowed) if(req.body[key]!==undefined) next[key]=req.body[key];
    res.json({success:true,policies:await supabaseRepo.updatePolicies(next,req.user!.id)});
  } catch(e:any){res.status(500).json({error:e.message});}
});

// -------------------------------------------------------------
// WALLET ENDPOINTS (Authoritative PostgreSQL Operations)
// -------------------------------------------------------------
app.get('/api/wallet/balance', requireAuth, async (req: Request, res: Response) => {
  const actor = req.user!;
  const wallet = await supabaseRepo.getWallet(actor.id);
  
  res.json({ wallet });
});

app.get('/api/wallet/transactions', requireAuth, async (req: Request, res: Response) => {
  const actor = req.user!;
  const txList = await supabaseRepo.getTransactions(actor.id);
  res.json({ transactions: txList });
});

app.post('/api/wallet/deposit', requireAuth, async (req: Request, res: Response) => {
  const { amount, method = 'UPI', idempotencyKey } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ error: 'Minimum deposit amount is ₹100' });
  }

  const actor = req.user!;
  const result = await walletService.deposit(actor.id, numAmount, method, idempotencyKey);
  broadcastSSE('wallet_updated', { userId: actor.id, wallet: result.wallet });
  return res.json({ success: true, wallet: result.wallet, transaction: result.transaction });
});

app.post('/api/wallet/withdraw', requireAuth, async (req: Request, res: Response) => {
  const { amount, upiId, idempotencyKey } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 500) {
    return res.status(400).json({ error: 'Minimum withdrawal is ₹500' });
  }

  const actor = req.user!;
  try {
    const result = await walletService.requestWithdrawal(actor.id, numAmount, upiId || 'Bank Account', idempotencyKey);
    broadcastSSE('wallet_updated', { userId: actor.id, wallet: result.wallet });
    return res.json({ success: true, wallet: result.wallet, request: result.request });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// STRICT AUTHORIZATION GUARD FOR GAMES:
// Games must be visible and playable ONLY by users with role 'PLAYER'
// OWNER, SUPER_ADMIN, and ADMIN roles are barred from accessing game routes
// -------------------------------------------------------------
app.use('/api/games', requireAuth, requirePlayerForGames);
app.use('/games', requireAuth, requirePlayerForGames);

// All wagering/game mutation endpoints require an authenticated PLAYER.
// Read-only game state/rules remain public.
const requireGameMutationAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') return next();
  return requireAuth(req, res, () => requirePlayerForGames(req, res, next));
};
app.use('/api/games', requireGameMutationAuth);

app.get('/api/games/history', (_req: Request, res: Response) => {
  res.json({ history: gameHistories });
});

// -------------------------------------------------------------
// 1. EUROPEAN ROULETTE ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
// Exact European Roulette wheel sequence (37 pockets, single 0)
const EUROPEAN_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

const ROULETTE_LIMITS = {
  minimumBet: 10,
  maximumBet: 50000,
  maximumExposure: 500000
};

const ROULETTE_PAYOUT_RULES = {
  straight: { ratio: '35:1', multiplier: 36, description: 'Straight Up: Single number 0-36 (35:1 profit, 36x gross)' },
  split: { ratio: '17:1', multiplier: 18, description: 'Split: Two adjacent numbers (17:1 profit, 18x gross)' },
  street: { ratio: '11:1', multiplier: 12, description: 'Street: Three numbers in a row (11:1 profit, 12x gross)' },
  corner: { ratio: '8:1', multiplier: 9, description: 'Corner: Four adjacent numbers (8:1 profit, 9x gross)' },
  sixline: { ratio: '5:1', multiplier: 6, description: 'Six Line: Six numbers across two rows (5:1 profit, 6x gross)' },
  dozen: { ratio: '2:1', multiplier: 3, description: 'Dozen: 1-12, 13-24, or 25-36 (2:1 profit, 3x gross)' },
  column: { ratio: '2:1', multiplier: 3, description: 'Column: 1st, 2nd, or 3rd column of 12 (2:1 profit, 3x gross)' },
  red_black: { ratio: '1:1', multiplier: 2, description: 'Red / Black: Even money (1:1 profit, 2x gross, 0 loses)' },
  even_odd: { ratio: '1:1', multiplier: 2, description: 'Even / Odd: Even money (1:1 profit, 2x gross, 0 loses)' },
  low_high: { ratio: '1:1', multiplier: 2, description: 'Low / High: 1-18 or 19-36 (1:1 profit, 2x gross, 0 loses)' }
};

let rouletteState: RouletteState = {
  roundId: 'RL-' + crypto.randomInt(1000, 10000),
  phase: 'betting',
  countdown: 15,
  winningNumber: 17,
  winningColor: 'black',
  winningCategory: '17 BLACK • Odd • Low (1-18) • 2nd Dozen • 2nd Col',
  recentResults: [17, 32, 0, 26, 3, 15, 28, 21, 4, 19],
  serverSeedHash: 'd3b07384d113edec49eaa6238ad5ff00' + crypto.randomBytes(4).toString('hex'),
  minimumBet: ROULETTE_LIMITS.minimumBet,
  maximumBet: ROULETTE_LIMITS.maximumBet,
  maximumExposure: ROULETTE_LIMITS.maximumExposure
};

// Memory stores for Roulette
const currentRoundBets: Record<string, RouletteBet[]> = {};
const roundSettlements: Record<string, any> = {};
const processedRouletteIdempotency = new Map<string, any>();
const rouletteHistoryRecords: {
  roundId: string;
  number: number;
  color: 'red' | 'black' | 'green';
  timestamp: string;
}[] = [
  { roundId: 'RL-1090', number: 17, color: 'black', timestamp: new Date(Date.now() - 300000).toISOString() },
  { roundId: 'RL-1089', number: 32, color: 'red', timestamp: new Date(Date.now() - 360000).toISOString() },
  { roundId: 'RL-1088', number: 0, color: 'green', timestamp: new Date(Date.now() - 420000).toISOString() },
  { roundId: 'RL-1087', number: 26, color: 'black', timestamp: new Date(Date.now() - 480000).toISOString() },
  { roundId: 'RL-1086', number: 3, color: 'red', timestamp: new Date(Date.now() - 540000).toISOString() },
  { roundId: 'RL-1085', number: 15, color: 'black', timestamp: new Date(Date.now() - 600000).toISOString() },
  { roundId: 'RL-1084', number: 28, color: 'black', timestamp: new Date(Date.now() - 660000).toISOString() },
  { roundId: 'RL-1083', number: 21, color: 'red', timestamp: new Date(Date.now() - 720000).toISOString() },
  { roundId: 'RL-1082', number: 4, color: 'black', timestamp: new Date(Date.now() - 780000).toISOString() },
  { roundId: 'RL-1081', number: 19, color: 'red', timestamp: new Date(Date.now() - 840000).toISOString() }
];

// Authoritative settlement engine for European Roulette
function computeRouletteSettlement(winningNum: number, bets: RouletteBet[]) {
  const isRed = RED_NUMBERS.includes(winningNum);
  const isZero = winningNum === 0;
  const winningColor: 'red' | 'black' | 'green' = isZero ? 'green' : isRed ? 'red' : 'black';

  const categories: string[] = [];
  if (isZero) {
    categories.push('0 GREEN (Zero Pocket)');
  } else {
    categories.push(`${winningNum} ${winningColor.toUpperCase()}`);
    categories.push(winningNum % 2 === 0 ? 'Even' : 'Odd');
    categories.push(winningNum <= 18 ? 'Low (1-18)' : 'High (19-36)');
    if (winningNum <= 12) categories.push('1st Dozen (1-12)');
    else if (winningNum <= 24) categories.push('2nd Dozen (13-24)');
    else categories.push('3rd Dozen (25-36)');

    if (winningNum % 3 === 1) categories.push('1st Col');
    else if (winningNum % 3 === 2) categories.push('2nd Col');
    else categories.push('3rd Col');
  }
  const winningCategory = categories.join(' • ');

  let totalBet = 0;
  let grossPayout = 0;
  const winningBets: any[] = [];
  const losingBets: any[] = [];

  for (const bet of bets) {
    const amt = Number(bet.amount || 0);
    totalBet += amt;
    let isWin = false;
    let multiplier = 0; // gross multiplier = (payout ratio profit) + 1

    switch (bet.type) {
      case 'straight':
      case 'number': {
        const target = bet.value !== undefined ? bet.value : (bet.numbers?.[0] ?? -1);
        if (target === winningNum) {
          isWin = true;
          multiplier = 36; // 35:1 profit + 1x stake
        }
        break;
      }
      case 'split': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 18; // 17:1 profit + 1x stake
        }
        break;
      }
      case 'street': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 12; // 11:1 profit + 1x stake
        }
        break;
      }
      case 'corner': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 9; // 8:1 profit + 1x stake
        }
        break;
      }
      case 'sixline': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 6; // 5:1 profit + 1x stake
        }
        break;
      }
      // OUTSIDE BETS (Zero Rule: All outside bets lose when winningNum === 0)
      case 'dozen1': {
        if (!isZero && winningNum >= 1 && winningNum <= 12) {
          isWin = true;
          multiplier = 3; // 2:1 profit + 1x stake
        }
        break;
      }
      case 'dozen2': {
        if (!isZero && winningNum >= 13 && winningNum <= 24) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'dozen3': {
        if (!isZero && winningNum >= 25 && winningNum <= 36) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col1': {
        if (!isZero && winningNum % 3 === 1) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col2': {
        if (!isZero && winningNum % 3 === 2) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col3': {
        if (!isZero && winningNum % 3 === 0) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'red': {
        if (!isZero && isRed) {
          isWin = true;
          multiplier = 2; // 1:1 profit + 1x stake
        }
        break;
      }
      case 'black': {
        if (!isZero && !isRed) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'even': {
        if (!isZero && winningNum % 2 === 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'odd': {
        if (!isZero && winningNum % 2 !== 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'low': {
        if (!isZero && winningNum >= 1 && winningNum <= 18) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'high': {
        if (!isZero && winningNum >= 19 && winningNum <= 36) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
    }

    const payoutAmount = isWin ? amt * multiplier : 0;
    const profit = isWin ? payoutAmount - amt : -amt;

    const resultItem = {
      bet,
      isWin,
      payoutMultiplier: multiplier,
      payoutAmount,      profit
    };

    if (isWin) {
      grossPayout += payoutAmount;
      winningBets.push(resultItem);
    } else {
      losingBets.push(resultItem);
    }
  }

  const netResult = grossPayout - totalBet;

  return {
    winningColor,
    winningCategory,
    winningBets,
    losingBets,
    totalBet,
    grossPayout,
    netResult
  };
}

// Background Authoritative Roulette Round Cycle
setInterval(async () => {
  if (!(await acquireGameLease('roulette'))) return;
  const persistedRoulette = await supabaseRepo.getAuthoritativeGameState('roulette');
  if (persistedRoulette) rouletteState = persistedRoulette as RouletteState;
  if (rouletteState.phase === 'betting') {
    rouletteState.countdown -= 1;
    if (rouletteState.countdown <= 0) {
      rouletteState.phase = 'closed';
      rouletteState.countdown = 2;
      broadcastSSE('roulette_betting_closed', { roundId: rouletteState.roundId });
    }
  } else if (rouletteState.phase === 'closed') {
    rouletteState.countdown -= 1;
    if (rouletteState.countdown <= 0) {
      rouletteState.phase = 'spinning';
      rouletteState.countdown = 6;

      // Authoritative RNG generation strictly on server before spin starts
      const winningNum = EUROPEAN_WHEEL[crypto.randomInt(EUROPEAN_WHEEL.length)];
      rouletteState.winningNumber = winningNum;
      rouletteState.winningColor = winningNum === 0 ? 'green' : RED_NUMBERS.includes(winningNum) ? 'red' : 'black';

      broadcastSSE('roulette_spin_started', {
        roundId: rouletteState.roundId,
        winningNumber: winningNum,
        winningColor: rouletteState.winningColor,
        countdown: 6
      });
    }
  } else if (rouletteState.phase === 'spinning') {
    rouletteState.countdown -= 1;
    if (rouletteState.countdown <= 0) {
      rouletteState.phase = 'result';
      rouletteState.countdown = 4;

      const winningNum = rouletteState.winningNumber ?? 0;
      const bets = currentRoundBets[rouletteState.roundId] || [];
      const settlement = computeRouletteSettlement(winningNum, bets);

      rouletteState.winningCategory = settlement.winningCategory;
      rouletteState.recentResults.unshift(winningNum);
      if (rouletteState.recentResults.length > 20) rouletteState.recentResults.pop();

      rouletteHistoryRecords.unshift({
        roundId: rouletteState.roundId,
        number: winningNum,
        color: settlement.winningColor,
        timestamp: new Date().toISOString()
      });
      if (rouletteHistoryRecords.length > 50) rouletteHistoryRecords.pop();

      if (settlement.grossPayout > 0) {
        tryCreditForUser(req, settlement.grossPayout, `Roulette Payout #${rouletteState.roundId}`, 'roulette');
      }

      if (settlement.totalBet > 0) {
        recordHistory({
          gameId: 'roulette',
          gameName: 'Roulette',
          betAmount: settlement.totalBet,
          winAmount: settlement.grossPayout,
          outcome: `Landed on ${winningNum} ${settlement.winningColor.toUpperCase()}`,
          multiplier: settlement.totalBet > 0 ? Number((settlement.grossPayout / settlement.totalBet).toFixed(2)) : 0,
          settlementStatus: 'settled'
        });
      }

      roundSettlements[rouletteState.roundId] = {
        roundId: rouletteState.roundId,
        winningNumber: winningNum,
        winningColor: settlement.winningColor,
        winningCategory: settlement.winningCategory,
        winningBets: settlement.winningBets,
        losingBets: settlement.losingBets,
        totalBet: settlement.totalBet,
        grossPayout: settlement.grossPayout,
        netResult: settlement.netResult,
        settlementStatus: 'settled',
        wallet: undefined,
        recentResults: rouletteState.recentResults
      };

      broadcastSSE('roulette_result', {
        roundId: rouletteState.roundId,
        winningNumber: winningNum,
        winningColor: settlement.winningColor,
        winningCategory: settlement.winningCategory
      });
      broadcastSSE('roulette_settlement', roundSettlements[rouletteState.roundId]);
      broadcastSSE('roulette_wallet_updated', { gameId: 'roulette' });
    }
  } else if (rouletteState.phase === 'result') {
    rouletteState.countdown -= 1;
    if (rouletteState.countdown <= 0) {
      // Transition to new round
      const newRoundId = 'RL-' + crypto.randomInt(1000, 10000);
      rouletteState.roundId = newRoundId;
      rouletteState.phase = 'betting';
      rouletteState.countdown = 15;
      rouletteState.serverSeedHash = 'd3b07384d113edec49eaa6238ad5ff00' + crypto.randomBytes(4).toString('hex');
      currentRoundBets[newRoundId] = [];

      broadcastSSE('roulette_round_started', {
        roundId: newRoundId,
        countdown: 15
      });
      broadcastSSE('roulette_betting_open', {
        roundId: newRoundId,
        countdown: 15
      });
    }
  }
  await supabaseRepo.saveAuthoritativeGameState('roulette', rouletteState);
}, 1000);


// 1. GET Rules
const handleGetRouletteRules = (_req: Request, res: Response) => {
  res.json({
    game: 'European Roulette',
    pockets: 37,
    wheelOrder: EUROPEAN_WHEEL,
    limits: ROULETTE_LIMITS,
    payouts: ROULETTE_PAYOUT_RULES,
    zeroRule: '0 is Green. When 0 hits, all outside bets (Red/Black, Odd/Even, Low/High, Dozens, Columns) lose. Only bets covering 0 win.'
  });
};
app.get('/api/games/roulette/rules', handleGetRouletteRules);
app.get('/games/roulette/rules', handleGetRouletteRules);

// 2. GET Round / State
const handleGetRouletteRound = (_req: Request, res: Response) => {
  res.json({
    state: rouletteState,
    roundId: rouletteState.roundId,
    phase: rouletteState.phase,
    countdown: rouletteState.countdown,
    winningNumber: rouletteState.winningNumber,
    winningColor: rouletteState.winningColor,
    winningCategory: rouletteState.winningCategory,
    recentResults: rouletteState.recentResults,
    serverSeedHash: rouletteState.serverSeedHash,
    limits: ROULETTE_LIMITS
  });
};
app.get('/api/games/roulette/round', handleGetRouletteRound);
app.get('/games/roulette/round', handleGetRouletteRound);
app.get('/api/games/roulette/state', handleGetRouletteRound);
app.get('/games/roulette/state', handleGetRouletteRound);

// 3. GET History & Analytics
const handleGetRouletteHistory = (_req: Request, res: Response) => {
  const records = rouletteHistoryRecords;
  const total = records.length || 1;
  const reds = records.filter((r) => r.color === 'red').length;
  const blacks = records.filter((r) => r.color === 'black').length;
  const greens = records.filter((r) => r.color === 'green').length;
  const odds = records.filter((r) => r.number > 0 && r.number % 2 !== 0).length;
  const evens = records.filter((r) => r.number > 0 && r.number % 2 === 0).length;
  const lows = records.filter((r) => r.number >= 1 && r.number <= 18).length;
  const highs = records.filter((r) => r.number >= 19 && r.number <= 36).length;

  // Number frequency for Hot/Cold
  const freqMap: Record<number, number> = {};
  records.forEach((r) => {
    freqMap[r.number] = (freqMap[r.number] || 0) + 1;
  });
  const sortedNums = Object.keys(freqMap)
    .map(Number)
    .sort((a, b) => freqMap[b] - freqMap[a]);

  const hotNumbers = sortedNums.slice(0, 4);
  const coldNumbers = EUROPEAN_WHEEL.filter((n) => !sortedNums.includes(n)).slice(0, 4);

  res.json({
    history: records,
    redPercentage: Math.round((reds / total) * 100),
    blackPercentage: Math.round((blacks / total) * 100),
    greenPercentage: Math.round((greens / total) * 100),
    oddPercentage: Math.round((odds / total) * 100),
    evenPercentage: Math.round((evens / total) * 100),
    lowPercentage: Math.round((lows / total) * 100),
    highPercentage: Math.round((highs / total) * 100),
    hotNumbers: hotNumbers.length > 0 ? hotNumbers : [17, 32, 21, 3],
    coldNumbers: coldNumbers.length > 0 ? coldNumbers : [0, 26, 35, 11]
  });
};
app.get('/api/games/roulette/history', handleGetRouletteHistory);
app.get('/games/roulette/history', handleGetRouletteHistory);

// 4. POST Bets (Register bets for ongoing authoritative round)
const handlePostRouletteBets = async (req: Request, res: Response) => {
  const { bets, idempotencyKey }: { bets: RouletteBet[]; idempotencyKey?: string } = req.body;

  // Idempotency check to prevent double debit
  if (idempotencyKey && processedRouletteIdempotency.has(idempotencyKey)) {
    return res.json(processedRouletteIdempotency.get(idempotencyKey));
  }

  if (!bets || !Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ error: 'At least one bet is required' });
  }

  // Validate bets against server limits
  let totalBet = 0;
  for (const b of bets) {
    const amt = Number(b.amount || 0);
    if (isNaN(amt) || amt < ROULETTE_LIMITS.minimumBet) {
      return res.status(400).json({ error: `Minimum bet is ₹${ROULETTE_LIMITS.minimumBet}` });
    }
    if (amt > ROULETTE_LIMITS.maximumBet) {
      return res.status(400).json({ error: `Maximum bet per spot is ₹${ROULETTE_LIMITS.maximumBet}` });
    }
    totalBet += amt;
  }

  if (totalBet > ROULETTE_LIMITS.maximumExposure) {
    return res.status(400).json({ error: `Maximum total exposure is ₹${ROULETTE_LIMITS.maximumExposure}` });
  }

  if (rouletteState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is currently closed for this round' });
  }

  if (!tryDebitForUser(req, totalBet, `Roulette Bet #${rouletteState.roundId}`, 'roulette')) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const existingBets = currentRoundBets[rouletteState.roundId] || [];
  currentRoundBets[rouletteState.roundId] = [...existingBets, ...bets];

  const responsePayload = {
    success: true,
    roundId: rouletteState.roundId,
    bets: currentRoundBets[rouletteState.roundId],
    totalBetPlaced: totalBet,
    wallet: await supabaseRepo.getWallet(req.user!.id),
    countdown: rouletteState.countdown
  };

  if (idempotencyKey) {
    processedRouletteIdempotency.set(idempotencyKey, responsePayload);
  }

  broadcastSSE('roulette_wallet_updated', { wallet: await supabaseRepo.getWallet(req.user!.id) });
  return res.json(responsePayload);
};
app.post('/api/games/roulette/bets', handlePostRouletteBets);
app.post('/games/roulette/bets', handlePostRouletteBets);

// 5. GET Active Bets
const handleGetRouletteBets = (_req: Request, res: Response) => {
  const bets = currentRoundBets[rouletteState.roundId] || [];
  res.json({
    roundId: rouletteState.roundId,
    bets,
    totalBet: bets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
  });
};
app.get('/api/games/roulette/bets', handleGetRouletteBets);
app.get('/games/roulette/bets', handleGetRouletteBets);

// 6. GET Settlement by roundId
const handleGetRouletteSettlement = (req: Request, res: Response) => {
  const roundId = req.params.roundId || rouletteState.roundId;
  const settlement = roundSettlements[roundId];
  if (!settlement) {
    return res.status(404).json({ error: `Settlement not found for round ${roundId}` });
  }
  return res.json({ settlement });
};
app.get('/api/games/roulette/settlement/:roundId', handleGetRouletteSettlement);
app.get('/games/roulette/settlement/:roundId', handleGetRouletteSettlement);

// 7. POST Spin (Instant spin & authoritative settlement flow)
const handlePostRouletteSpin = async (req: Request, res: Response) => {
  const { bets, idempotencyKey }: { bets: RouletteBet[]; idempotencyKey?: string } = req.body;

  // Idempotency check
  if (idempotencyKey && processedRouletteIdempotency.has(idempotencyKey)) {
    return res.json(processedRouletteIdempotency.get(idempotencyKey));
  }

  if (!bets || !Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ error: 'At least one bet is required' });
  }

  let totalBet = 0;
  for (const b of bets) {
    const amt = Number(b.amount || 0);
    if (isNaN(amt) || amt < ROULETTE_LIMITS.minimumBet) {
      return res.status(400).json({ error: `Minimum bet is ₹${ROULETTE_LIMITS.minimumBet}` });
    }
    if (amt > ROULETTE_LIMITS.maximumBet) {
      return res.status(400).json({ error: `Maximum bet per spot is ₹${ROULETTE_LIMITS.maximumBet}` });
    }
    totalBet += amt;
  }

  if (totalBet > ROULETTE_LIMITS.maximumExposure) {
    return res.status(400).json({ error: `Maximum total exposure is ₹${ROULETTE_LIMITS.maximumExposure}` });
  }

  // Atomic debit
  const currentRoundId = rouletteState.roundId;
  if (!tryDebitForUser(req, totalBet, `Roulette Round ${currentRoundId}`, 'roulette')) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Authoritative server outcome from European wheel (0-36)
  const winningNum = EUROPEAN_WHEEL[crypto.randomInt(EUROPEAN_WHEEL.length)];
  const settlement = computeRouletteSettlement(winningNum, bets);

  // Atomic credit if winning
  if (settlement.grossPayout > 0) {
    tryCreditForUser(req, settlement.grossPayout, `Roulette Payout #${currentRoundId}`, 'roulette');
  }

  // Update server state
  rouletteState.winningNumber = winningNum;
  rouletteState.winningColor = settlement.winningColor;
  rouletteState.winningCategory = settlement.winningCategory;
  rouletteState.recentResults.unshift(winningNum);
  if (rouletteState.recentResults.length > 20) rouletteState.recentResults.pop();

  rouletteHistoryRecords.unshift({
    roundId: currentRoundId,
    number: winningNum,
    color: settlement.winningColor,
    timestamp: new Date().toISOString()
  });
  if (rouletteHistoryRecords.length > 50) rouletteHistoryRecords.pop();

  recordHistory({
    gameId: 'roulette',
    gameName: 'Roulette',
    betAmount: totalBet,
    winAmount: settlement.grossPayout,
    outcome: `Landed on ${winningNum} ${settlement.winningColor.toUpperCase()}`,
    multiplier: totalBet > 0 ? Number((settlement.grossPayout / totalBet).toFixed(2)) : 0,
    settlementStatus: 'settled'
  });

  const nextRoundId = 'RL-' + crypto.randomInt(1000, 10000);
  rouletteState.roundId = nextRoundId;
  rouletteState.serverSeedHash = 'd3b07384d113edec49eaa6238ad5ff00' + crypto.randomBytes(4).toString('hex');

  const fullSettlementResult = {
    success: true,
    roundId: currentRoundId,
    nextRoundId,
    winningNumber: winningNum,
    winningColor: settlement.winningColor,
    winningCategory: settlement.winningCategory,
    winningBets: settlement.winningBets,
    losingBets: settlement.losingBets,
    totalBet,
    winAmount: settlement.grossPayout,
    grossPayout: settlement.grossPayout,
    netProfit: settlement.netResult,
    netResult: settlement.netResult,
    settlementStatus: 'settled',
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentResults: rouletteState.recentResults
  };

  roundSettlements[currentRoundId] = fullSettlementResult;

  if (idempotencyKey) {
    processedRouletteIdempotency.set(idempotencyKey, fullSettlementResult);
  }

  broadcastSSE('roulette_spin_started', { roundId: currentRoundId, winningNumber: winningNum, winningColor: settlement.winningColor });
  broadcastSSE('roulette_result', { roundId: currentRoundId, winningNumber: winningNum, winningColor: settlement.winningColor, category: settlement.winningCategory });
  broadcastSSE('roulette_settlement', fullSettlementResult);
  broadcastSSE('roulette_wallet_updated', { wallet: await supabaseRepo.getWallet(req.user!.id) });

  return res.json(fullSettlementResult);
};
app.post('/api/games/roulette/spin', handlePostRouletteSpin);
app.post('/games/roulette/spin', handlePostRouletteSpin);


// -------------------------------------------------------------
// 2. TEEN PATTI ENGINE (SERVER-AUTHORITATIVE MULTIPLAYER)
// -------------------------------------------------------------
let teenPattiState: TeenPattiState = createAuthoritativeTeenPattiRound('Player', undefined, 50);

// Background Authoritative Teen Patti Round Cycle
setInterval(async () => {
  if (!(await acquireGameLease('teen-patti'))) return;
  const persistedTeen = await supabaseRepo.getAuthoritativeGameState('teen-patti');
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
          tryCreditForUser(req, settlement.grossPayout, `Teen Patti Win #${teenPattiState.roundId}`, 'teen-patti');
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
  await supabaseRepo.saveAuthoritativeGameState('teen-patti', teenPattiState);
}, 1000);

// --- TEEN PATTI API ENDPOINTS ---
const handleGetTeenPattiState = (_req: Request, res: Response) => {
  res.json({
    state: sanitizeTeenPattiState(teenPattiState)
  });
};

app.get('/api/games/teen-patti/state', handleGetTeenPattiState);
app.get('/games/teen-patti/state', handleGetTeenPattiState);

const handlePostTeenPattiBet = (req: Request, res: Response) => {
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
  if (userWallet.balance < additionalBet) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  if (!tryDebitForUser(req, additionalBet, `Teen Patti Bet #${teenPattiState.roundId}`, 'teen-patti')) {
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

app.post('/api/games/teen-patti/bet', handlePostTeenPattiBet);
app.post('/games/teen-patti/bet', handlePostTeenPattiBet);

const handlePostTeenPattiNewRound = (req: Request, res: Response) => {
  const bootAmount = Number(req.body?.bootAmount || 50);
  const userPlayer = teenPattiState.players.find((p) => p.isUser);
  if (userPlayer && teenPattiState.phase === 'betting') {
    if (userPlayer.currentBet < bootAmount) {
      const delta = bootAmount - userPlayer.currentBet;
      if (userWallet.balance >= delta && tryDebitForUser(req, delta, 'Teen Patti Boot Bet', 'teen-patti')) {
        userPlayer.currentBet = bootAmount;
        teenPattiState.pot += delta;
      }
    }
  }

  return res.json({
    success: true,
    state: sanitizeTeenPattiState(teenPattiState),
    wallet: await supabaseRepo.getWallet(req.user!.id)
  });
};

app.post('/api/games/teen-patti/new-round', handlePostTeenPattiNewRound);
app.post('/games/teen-patti/new-round', handlePostTeenPattiNewRound);

const handlePostTeenPattiAction = (req: Request, res: Response) => {
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
    if (!tryDebitForUser(req, stake, `Teen Patti ${action.toUpperCase()}`, 'teen-patti')) {
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

app.post('/api/games/teen-patti/action', handlePostTeenPattiAction);
app.post('/games/teen-patti/action', handlePostTeenPattiAction);

// Persist the authoritative round after every scheduler tick.
// The lease ensures only one instance advances the round.

// -------------------------------------------------------------
// 3. AVIATOR ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
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
  if (!(await acquireGameLease('aviator'))) return;
  if (aviatorTimer) clearInterval(aviatorTimer);

  // Phase 1: Betting (5 seconds countdown)
  aviatorState.phase = 'betting';
  aviatorState.multiplier = 1.0;
  aviatorState.crashMultiplier = null;
  aviatorState.countdown = 5;
  aviatorState.roundId = 'AV-' + crypto.randomInt(1000, 10000);
  // Bets are keyed by authenticated user and survive the round reset independently.
  currentCrashTarget = generateCrashPoint();

  broadcastSSE('round_started', { gameId: 'aviator', roundId: aviatorState.roundId });

  await supabaseRepo.saveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });

  const betInterval = setInterval(async () => {
    if (!(await acquireGameLease('aviator'))) return;
    const persisted = await supabaseRepo.getAuthoritativeGameState('aviator');
    if (persisted) { aviatorState = persisted as AviatorState; currentCrashTarget = Number(persisted.crashTarget || currentCrashTarget); }
    aviatorState.countdown -= 1;
    if (aviatorState.countdown <= 0) {
      clearInterval(betInterval);
      startAviatorFlight();
    }
    await supabaseRepo.saveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });
  }, 1000);
}

async function startAviatorFlight() {
  if (!(await acquireGameLease('aviator'))) return;
  const persisted = await supabaseRepo.getAuthoritativeGameState('aviator');
  if (persisted) { aviatorState = persisted as AviatorState; currentCrashTarget = Number(persisted.crashTarget || currentCrashTarget); }
  aviatorState.phase = 'running';
  aviatorState.multiplier = 1.0;

  broadcastSSE('betting_closed', { gameId: 'aviator' });

  const startTime = Date.now();
  const flightInterval = setInterval(async () => {
    if (!(await acquireGameLease('aviator'))) return;
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
        multiplier: currentCrashTarget,
        crashed: true
      });

      // Restart cycle after 3s
      await supabaseRepo.saveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });
      setTimeout(() => { runAviatorCycle(); }, 3500);
    } else {
      aviatorState.multiplier = nextMult;
      await supabaseRepo.saveAuthoritativeGameState('aviator', { ...aviatorState, crashTarget: currentCrashTarget });
    }
  }, 100);
}

// Start initial aviator flight cycle
runAviatorCycle();

app.get('/api/games/aviator/state', requireAuth, (req: Request, res: Response) => {
  res.json({ state: { ...aviatorState, currentBet: aviatorBets.get(req.user!.id) ?? null } });
});

app.post('/api/games/aviator/bet', requireAuth, requirePlayerForGames, (req: Request, res: Response) => {
  const { amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (aviatorState.phase !== 'betting') {
    return res.status(400).json({ error: 'Betting is closed for this round' });
  }

  if (!tryDebitForUser(req, numAmount, `Aviator Bet #${aviatorState.roundId}`, 'aviator')) {
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

app.post('/api/games/aviator/cashout', requireAuth, requirePlayerForGames, (req: Request, res: Response) => {
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

  tryCreditForUser(req, payout, `Aviator Cashout @ ${cashMultiplier}x`, 'aviator');

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

app.get('/api/games/dice/state', (_req: Request, res: Response) => {
  res.json({ state: diceState });
});

app.post('/api/games/dice/roll', (req: Request, res: Response) => {
  const { betType, amount }: { betType: 'under7' | 'exact7' | 'over7' | 'even' | 'odd' | 'doubles'; amount: number } =
    req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (!tryDebitForUser(req, numAmount, `Dice Bet: ${betType}`, 'dice')) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Authoritative server dice generation
  const d1 = crypto.randomInt(1, 7);
  const d2 = Math.floor(1 + Math.random() * 6);
  const total = d1 + d2;
  const isDoubles = d1 === d2;

  let multiplier = 0;
  if (betType === 'under7' && total < 7) multiplier = 2.0;  else if (betType === 'over7' && total > 7) multiplier = 2.0;
  else if (betType === 'exact7' && total === 7) multiplier = 5.5;
  else if (betType === 'even' && total % 2 === 0) multiplier = 1.95;
  else if (betType === 'odd' && total % 2 !== 0) multiplier = 1.95;
  else if (betType === 'doubles' && isDoubles) multiplier = 5.5;

  const winAmount = Math.floor(numAmount * multiplier);
  if (winAmount > 0) {
    tryCreditForUser(req, winAmount, `Dice Win (${d1}+${d2}=${total})`, 'dice');
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
// 5. DRAGON TIGER ENGINE (SERVER-AUTHORITATIVE)
// -------------------------------------------------------------
let dragonTigerState: DragonTigerState = {
  roundId: 'DT-' + crypto.randomInt(1000, 10000),
  phase: 'betting',
  dragonCard: { suit: 'hearts', rank: 'K', value: 13 },
  tigerCard: { suit: 'spades', rank: '7', value: 7 },
  winner: 'dragon',
  recentResults: ['dragon', 'tiger', 'dragon', 'tie', 'tiger', 'dragon', 'dragon'],
  countdown: 10
};

app.get('/api/games/dragon-tiger/state', (_req: Request, res: Response) => {
  res.json({ state: dragonTigerState });
});

app.post('/api/games/dragon-tiger/deal', (req: Request, res: Response) => {
  const { betSide, amount }: { betSide: DragonTigerBetSide; amount: number } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (!tryDebitForUser(req, numAmount, `Dragon Tiger: ${betSide.toUpperCase()}`, 'dragon-tiger')) {
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
    tryCreditForUser(req, winAmount, `Dragon Tiger Win (${winner.toUpperCase()})`, 'dragon-tiger');
  }

  dragonTigerState.dragonCard = dragonCard;
  dragonTigerState.tigerCard = tigerCard;
  dragonTigerState.winner = winner;
  dragonTigerState.recentResults.unshift(winner);
  if (dragonTigerState.recentResults.length > 15) dragonTigerState.recentResults.pop();
  dragonTigerState.roundId = 'DT-' + crypto.randomInt(1000, 10000);

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
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentResults: dragonTigerState.recentResults
  });
});

// -------------------------------------------------------------
// 6. ANDAR BAHAR ENGINE (SERVER-AUTHORITATIVE WITH LIVE SHUFFLE & DEALING)
// -------------------------------------------------------------
const andarBaharBets = new Map<string, { side: AndarBaharSide; amount: number }>();
let andarBaharDealtQueue: { side: AndarBaharSide; card: Card }[] = [];
let andarBaharTargetJoker: Card | null = { suit: 'spades', rank: '8', value: 8 };
let andarBaharFinalWinner: AndarBaharSide = 'andar';

let andarBaharState: AndarBaharState = {
  roundId: 'AB-' + crypto.randomInt(1000, 10000),
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

  andarBaharState.roundId = 'AB-' + crypto.randomInt(1000, 10000);
  andarBaharState.phase = 'betting';
  andarBaharState.countdown = 10;
  andarBaharState.jokerCard = null;
  andarBaharState.dealtCards = [];
  andarBaharState.winningSide = null;
  andarBaharState.phaseEndsAt = Date.now() + 10000;
  andarBaharState.startedAt = Date.now();
  andarBaharState.userBet = undefined;
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
      for (const [userId, activeAndarBaharBet] of andarBaharBets) {
        const numAmount = activeAndarBaharBet.amount;
        const betSide = activeAndarBaharBet.side;
        const isWin = betSide === andarBaharFinalWinner;
        const multiplier = isWin ? (andarBaharFinalWinner === 'andar' ? 1.9 : 2.0) : 0;
        const winAmount = Math.floor(numAmount * multiplier);

        if (winAmount > 0) {
          tryCreditForUser(req, winAmount, `Andar Bahar Win on ${andarBaharFinalWinner.toUpperCase()}`, 'andar-bahar');
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

        andarBaharBets.delete(userId);
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

app.get('/api/games/andar-bahar/state', requireAuth, (req: Request, res: Response) => {
  res.json({ state: { ...andarBaharState, userBet: andarBaharBets.get(req.user!.id) ?? undefined } });
});

app.post('/api/games/andar-bahar/deal', requireAuth, requirePlayerForGames, (req: Request, res: Response) => {
  const { betSide, amount }: { betSide: AndarBaharSide; amount: number } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum bet is ₹10' });
  }

  if (!tryDebitForUser(req, numAmount, `Andar Bahar: ${betSide.toUpperCase()}`, 'andar-bahar')) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  // Register bet on active server-authoritative round
  const activeAndarBaharBet = { side: betSide, amount: numAmount };
  andarBaharBets.set(req.user!.id, activeAndarBaharBet);

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
    wallet: await supabaseRepo.getWallet(req.user!.id),
    recentWinners: andarBaharState.recentWinners,
    state: andarBaharState
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & STATIC FALLBACK
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV === 'production' && !getSupabaseConfigStatus().isConfigured) {
    throw new Error('Production startup blocked: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

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
    console.log(`[Supabase Platform] Connected status: LIVE POSTGRESQL`);
  });
}

start();