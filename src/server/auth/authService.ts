import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { User, UserRole, Wallet } from '../../types.ts';
import { supabaseRepo, getSupabaseAdmin } from '../supabase/supabaseClient.ts';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
      wallet?: Wallet;
    }
  }
}

export interface AuthSession {
  token: string;
  user: User;
  wallet: Wallet;
}

// Memory session cache (maps token -> userId)
const sessionTokens = new Map<string, { userId: string; expiresAt: number }>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-session-secret');


export const authService = {
  logout(token: string): void {
    sessionTokens.delete(token);
  },

  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      return token || null;
    }
    return null;
  },

  async resolveUserFromToken(token: string): Promise<User | null> {
    if (!token) return null;
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const { data: { user: sbUser }, error } = await admin.auth.getUser(token);
        if (!error && sbUser) {
          return await supabaseRepo.getUserById(sbUser.id);
        }
      } catch {
        // Invalid/expired JWT.
      }
    }
    const local = verifySessionToken(token);
    return local ? supabaseRepo.getUserById(local.userId) : null;
  },

  async login(identifier: string, _codeOrPassword?: string): Promise<AuthSession> {
    const user = await supabaseRepo.getUserByEmailOrMobile(identifier);
    if (!user) throw new Error('Account not found. Please register first.');
    const token = createSessionToken(user.id);
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  async register(mobile: string, username: string, _role: UserRole = 'PLAYER', parentId?: string): Promise<AuthSession> {
    const existing = await supabaseRepo.getUserByEmailOrMobile(mobile);
    if (existing) throw new Error('An account with this mobile number already exists.');

    const user = await supabaseRepo.createUser({
      id: `usr_${crypto.randomUUID()}`,
      mobile: mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g, '')}`,
      username,
      role: 'PLAYER',
      parentId,
      vipTier: 'Bronze',
      isDemo: false,
      createdAt: new Date().toISOString()
    });

    const token = createSessionToken(user.id);
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  async switchRole(userId: string, newRole: UserRole): Promise<AuthSession> {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_ROLE_SWITCH !== 'true') {
      throw new Error('Role switching is disabled.');
    }
    const updatedUser = await supabaseRepo.updateUserRole(userId, newRole);
    if (!updatedUser) throw new Error('User not found');
    const token = createSessionToken(userId);
    const wallet = await supabaseRepo.getWallet(userId);
    return { token, user: updatedUser, wallet };
  },

  canManageUser(actor: User, targetRole: UserRole): boolean {
    if (actor.role === 'OWNER') return true;
    if (actor.role === 'SUPER_ADMIN') return targetRole === 'ADMIN' || targetRole === 'PLAYER';
    if (actor.role === 'ADMIN') return targetRole === 'PLAYER';
    return false;
  }
};

function createSessionToken(userId: string): string {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET is required in production');
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `brix_${payload}.${signature}`;
}

function verifySessionToken(token: string): { userId: string } | null {
  if (!SESSION_SECRET || !token.startsWith('brix_')) return null;
  const raw = token.slice(5);
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub: string; exp: number };
    if (!data.sub || !data.exp || data.exp <= Date.now()) return null;
    return { userId: data.sub };
  } catch { return null; }
}
// ---------------------------------------------------------------------
// EXPRESS MIDDLEWARES
// ---------------------------------------------------------------------

// 1. Authenticate user from Supabase token / session
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = authService.extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: Authentication token required' });

  const user = await authService.resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }

  req.user = user;
  req.wallet = await supabaseRepo.getWallet(user.id);
  next();
}

// 2. Strict Game Access: GAMES MUST BE VISIBLE ONLY TO PLAYER USERS
export function requirePlayerForGames(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'PLAYER') {
    return res.status(403).json({
      error: `Forbidden: Games are strictly accessible only to PLAYER accounts. Current role is ${req.user.role}. Non-player roles must use the Admin Management Console.`
    });
  }

  next();
}

// 3. Admin / Owner Role Guards
export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
      });
    }

    next();
  };
}
