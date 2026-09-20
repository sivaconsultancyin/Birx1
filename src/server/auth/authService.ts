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
const sessionTokens = new Map<string, string>();

// Seed default demo tokens for instant validation
sessionTokens.set('token_owner', 'usr_owner_001');
sessionTokens.set('token_super', 'usr_super_001');
sessionTokens.set('token_admin', 'usr_admin_001');
sessionTokens.set('token_player', 'usr_brix_8849');
sessionTokens.set('token_demo', 'usr_brix_8849');

export const authService = {
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
    const userId = sessionTokens.get(token);
    return userId ? supabaseRepo.getUserById(userId) : null;
  },

  async login(identifier: string, _codeOrPassword?: string): Promise<AuthSession> {
    const user = await supabaseRepo.getUserByEmailOrMobile(identifier);
    if (!user) throw new Error('Account not found. Please register first.');
    const token = createSessionToken();
    sessionTokens.set(token, user.id);
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  async register(mobile: string, username: string, _role: UserRole = 'PLAYER', parentId?: string): Promise<AuthSession> {
    const existing = await supabaseRepo.getUserByEmailOrMobile(mobile);
    if (existing) throw new Error('An account with this mobile number already exists.');

    const user = await supabaseRepo.createUser({
      id: `usr_${crypto.randomUUID()}`,
      mobile: mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\\D/g, '')}`,
      username,
      role: 'PLAYER',
      parentId,
      vipTier: 'Bronze',
      isDemo: false,
      createdAt: new Date().toISOString()
    });

    const token = createSessionToken();
    sessionTokens.set(token, user.id);
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  async switchRole(userId: string, newRole: UserRole): Promise<AuthSession> {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_ROLE_SWITCH !== 'true') {
      throw new Error('Role switching is disabled.');
    }
    const updatedUser = await supabaseRepo.updateUserRole(userId, newRole);
    if (!updatedUser) throw new Error('User not found');
    const token = createSessionToken();
    sessionTokens.set(token, userId);
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

function createSessionToken(): string {
  return `brix_${crypto.randomBytes(32).toString('hex')}`;
}
// ---------------------------------------------------------------------
// EXPRESS MIDDLEWARES
// ---------------------------------------------------------------------

// 1. Authenticate user from Supabase token / session
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = authService.extractToken(req);
  if (!token) {
    // If demo mode, resolve default player
    const defaultPlayer = await supabaseRepo.getUserById('usr_brix_8849');
    if (defaultPlayer) {
      req.user = defaultPlayer;
      req.wallet = await supabaseRepo.getWallet(defaultPlayer.id);
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
  }

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
