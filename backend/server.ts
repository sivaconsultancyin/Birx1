import express, { Request, Response, NextFunction } from 'express';
import { registerRouletteGame } from './games/roulette/game.ts';
import { registerTeenPattiGame } from './games/teen-patti/game.ts';
import { registerAviatorGame } from './games/aviator/game.ts';
import { registerDiceGame } from './games/dice/game.ts';
import { registerDragonTigerGame } from './games/dragon-tiger/game.ts';
import { registerAndarBaharGame } from './games/andar-bahar/game.ts';


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
} from './types.ts';
import {
  generateDeck,
  secureShuffleDeck,
  evaluateTeenPattiHand,
  compareHands,
  computePlayerSettlement,
  createAuthoritativeTeenPattiRound,
  sanitizeTeenPattiState
} from './engines/teenPattiEngine.ts';
import { supabaseRepo, getSupabaseConfigStatus } from './supabase/supabaseClient.ts';
import { authService, requireAuth, requirePlayerForGames, requireRoles } from './auth/authService.ts';
import { walletService } from './wallet/walletService.ts';
import { storageService } from './storage/storageService.ts';
import { gameRecoveryService } from './recovery/gameRecoveryService.ts';


const app = express();
const PORT = 3000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= limit) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    bucket.count += 1;
    next();
  };
}
function setAuthCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `brix_access_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600${secure}`);
}
function clearAuthCookie(res: Response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `brix_access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

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
function recordHistory(entry: Omit<GameHistoryEntry, 'id' | 'createdAt'> & Partial<Pick<GameHistoryEntry, 'id' | 'createdAt'>>) {
  const normalized: GameHistoryEntry = {
    id: entry.id || `hist_${crypto.randomUUID()}`,
    createdAt: entry.createdAt || new Date().toISOString(),
    gameId: entry.gameId,
    gameName: entry.gameName,
    betAmount: Number(entry.betAmount) || 0,
    winAmount: Number(entry.winAmount) || 0,
    netProfit: entry.netProfit,
    outcome: String(entry.outcome || ''),
    multiplier: Number(entry.multiplier) || 0,
    settlementStatus: entry.settlementStatus
  };
  gameHistories.unshift(normalized);
  if (gameHistories.length > 500) gameHistories.pop();
  return normalized;
}
const transactions: Transaction[] = [];
const PROCESS_OWNER_ID = `brix-${process.pid}-${crypto.randomUUID()}`;
let leaseConfigWarningShown = false;
async function acquireGameLease(gameId: string): Promise<boolean> {
  // Keep the local game loop alive when the lease RPC is unavailable.
  // A single Node process can safely use its in-memory authoritative state.
  if (!getSupabaseConfigStatus().isConfigured) {
    if (!leaseConfigWarningShown) {
      console.warn('[GameLease] Supabase lease unavailable; using single-process local game loop.');
      leaseConfigWarningShown = true;
    }
    return true;
  }
  try {
    const claimed = await supabaseRepo.claimGameLease(gameId, PROCESS_OWNER_ID, 4000);
    return Boolean(claimed);
  } catch (e) {
    // When Supabase is configured, never fall back to a second local authority:
    // doing so could create competing rounds across server instances.
    console.error(`[GameLease:${gameId}] lease RPC unavailable; refusing authority.`, e);
    return false;
  }
}

async function safeSaveAuthoritativeGameState(gameId: string, state: any): Promise<void> {
  try {
    if (getSupabaseConfigStatus().isConfigured) {
      await supabaseRepo.saveAuthoritativeGameState(gameId, state);
    }
  } catch (e) {
    console.warn(`[GameState:${gameId}] persistence unavailable; keeping local authoritative state.`, e);
  }
}

async function safeGetAuthoritativeGameState(gameId: string): Promise<any | null> {
  try {
    if (!getSupabaseConfigStatus().isConfigured) return null;
    return await supabaseRepo.getAuthoritativeGameState(gameId);
  } catch (e) {
    console.warn(`[GameState:${gameId}] read unavailable; keeping local authoritative state.`, e);
    return null;
  }
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
// -------------------------------------------------------------
// SSE STREAM FOR REAL-TIME EVENTS
// -------------------------------------------------------------
const sseClients: Array<{ res: Response; userId: string }> = [];

function broadcastSSE(event: string, data: any) {
  const payloadData = { type: event, ...data };
  const messagePayload = `data: ${JSON.stringify(payloadData)}\n\n`;
  const eventPayload = `event: ${event}\ndata: ${JSON.stringify(payloadData)}\n\n`;
  sseClients.forEach(({ res, userId }) => {
    const targetUserId = data?.userId || data?.playerId || null;
    if (targetUserId && targetUserId !== userId) return;
    try { res.write(messagePayload); res.write(eventPayload); } catch { /* client dropped */ }
  });
}

const handleSSEConnection = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client = { res, userId: req.user!.id };
  sseClients.push(client);
  res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    const index = sseClients.indexOf(client);
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
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('Invalid mobile number');
  return digits;
}

app.post('/api/auth/login', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  try {
    const mobile = normalizeMobile(req.body.mobile);
    const password = String(req.body.password || '');
    const session = await authService.login(mobile, password);
    setAuthCookie(res, session.token);
    res.json({ success: true, token: session.token, user: session.user, wallet: session.wallet });
  } catch (err: any) { res.status(401).json({ error: err.message || 'Invalid credentials' }); }
});

app.post('/api/auth/register', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const mobile = normalizeMobile(req.body.mobile);
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (username.length < 3 || username.length > 50) return res.status(400).json({ error: 'Username must be 3-50 characters' });
    const session = await authService.register(mobile, username, password, 'PLAYER');
    setAuthCookie(res, session.token);
    res.status(201).json({ success: true, token: session.token, user: session.user, wallet: session.wallet });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  res.json({ user: req.user, wallet: req.wallet });
});

app.post('/api/auth/logout', requireAuth, async (req: Request, res: Response) => {
  const token = authService.extractToken(req);
  if (token) await authService.logout(token);
  clearAuthCookie(res);
  res.json({ success: true });
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
    const { mobile, username, role, password } = req.body;
    if (!mobile || !username || !role || !password) {
      return res.status(400).json({ error: 'mobile, username, role, and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!authService.canManageUser(actor, role)) {
      return res.status(403).json({ error: `Actor with role ${actor.role} cannot create user with role ${role}` });
    }

    const session = await authService.register(String(mobile), String(username).trim(), String(password), role, actor.id);
    res.json({ success: true, user: session.user });
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
  return res.json({ success: true, wallet: result.wallet, request: result.request });
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
// Game state/rules GET endpoints are public so the client can synchronize the
// authoritative room/round before authentication. Betting/mutation endpoints
// remain protected below.
// -------------------------------------------------------------

// All wagering/game mutation endpoints require an authenticated PLAYER.
// Read-only game state/rules remain public.
const requireGameMutationAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') return next();
  return requireAuth(req, res, () => requirePlayerForGames(req, res, next));
};
app.use('/api/games', requireGameMutationAuth);

app.get('/api/games/history', requireAuth, requirePlayerForGames, (_req: Request, res: Response) => {
  res.json({ history: gameHistories });
});

// -------------------------------------------------------------
const gameModuleDeps = {
  supabaseRepo, requireAuth, requirePlayerForGames, requireRoles, walletService, storageService,
  recordHistory, broadcastSSE, acquireGameLease, safeSaveAuthoritativeGameState,
  safeGetAuthoritativeGameState, debitForUser, creditForUser, getRequestUser,
  generateDeck, secureShuffleDeck, evaluateTeenPattiHand, compareHands,
  computePlayerSettlement, createAuthoritativeTeenPattiRound, sanitizeTeenPattiState,
  rateLimit, getSupabaseConfigStatus, authService, crypto
};

registerRouletteGame(app, gameModuleDeps);
registerTeenPattiGame(app, gameModuleDeps);
registerAviatorGame(app, gameModuleDeps);
registerDiceGame(app, gameModuleDeps);
registerDragonTigerGame(app, gameModuleDeps);
registerAndarBaharGame(app, gameModuleDeps);

const startServer = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('[server] startup failed:', error);
    process.exit(1);
  }
};

startServer();
