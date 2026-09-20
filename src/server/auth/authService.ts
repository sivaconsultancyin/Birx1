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
  // Extract token from request headers
  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    const tokenQuery = req.query.token as string;
    if (tokenQuery) return tokenQuery;
    return null;
  },

  // Resolve user from token
  async resolveUserFromToken(token: string): Promise<User | null> {
    if (!token) return null;

    // 1. Check if token is a Supabase JWT
    const admin = getSupabaseAdmin();
    if (admin && token.startsWith('eyJ')) {
      try {
        const { data: { user: sbUser }, error } = await admin.auth.getUser(token);
        if (!error && sbUser) {
          const dbUser = await supabaseRepo.getUserById(sbUser.id);
          if (dbUser) return dbUser;
        }
      } catch {
        // Fall back to token map
      }
    }

    // 2. Check local session token map
    const userId = sessionTokens.get(token);
    if (userId) {
      return supabaseRepo.getUserById(userId);
    }

    // 3. Fallback: default player for demo token
    if (token === 'token_demo' || token === 'token_player') {
      return supabaseRepo.getUserById('usr_brix_8849');
    }

    return null;
  },

  // Login with mobile or email + OTP/password
  async login(identifier: string, _codeOrPassword?: string): Promise<AuthSession> {
    let user = await supabaseRepo.getUserByEmailOrMobile(identifier);

    // If identifier is not found, default to player or create on-the-fly demo player
    if (!user) {
      user = await supabaseRepo.createUser({
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        mobile: identifier.startsWith('+') ? identifier : `+91 ${identifier}`,
        email: identifier.includes('@') ? identifier : undefined,
        username: `Player_${identifier.slice(-4) || 'VIP'}`,
        role: 'PLAYER',
        parentId: 'usr_admin_001',
        vipTier: 'Bronze',
        isDemo: true,
        createdAt: new Date().toISOString()
      });
    }

    const token = `token_${user.role.toLowerCase()}_${user.id}`;
    sessionTokens.set(token, user.id);

    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  // Register new account
  async register(mobile: string, username: string, role: UserRole = 'PLAYER', parentId?: string): Promise<AuthSession> {
    const existing = await supabaseRepo.getUserByEmailOrMobile(mobile);
    if (existing) {
      return this.login(mobile);
    }

    const user = await supabaseRepo.createUser({
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      mobile: mobile.startsWith('+') ? mobile : `+91 ${mobile}`,
      username: username || `Player_${mobile.slice(-4)}`,
      role,
      parentId: parentId || (role === 'PLAYER' ? 'usr_admin_001' : undefined),
      vipTier: 'Bronze',
      isDemo: true,
      createdAt: new Date().toISOString()
    });

    const token = `token_${user.role.toLowerCase()}_${user.id}`;
    sessionTokens.set(token, user.id);

    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  // Switch role for quick testing/validation in UI
  async switchRole(userId: string, newRole: UserRole): Promise<AuthSession> {
    const updatedUser = await supabaseRepo.updateUserRole(userId, newRole);
    if (!updatedUser) throw new Error('User not found');

    const token = `token_${newRole.toLowerCase()}_${userId}`;
    sessionTokens.set(token, userId);

    const wallet = await supabaseRepo.getWallet(userId);
    return { token, user: updatedUser, wallet };
  },

  // Verify hierarchy management permission:
  // OWNER can manage ALL
  // SUPER_ADMIN can manage ADMIN and PLAYER
  // ADMIN can manage PLAYER
  // PLAYER can manage NONE
  canManageUser(actor: User, targetRole: UserRole): boolean {
    if (actor.role === 'OWNER') return true;
    if (actor.role === 'SUPER_ADMIN') {
      return targetRole === 'ADMIN' || targetRole === 'PLAYER';
    }
    if (actor.role === 'ADMIN') {
      return targetRole === 'PLAYER';
    }
    return false;
  }
};

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
