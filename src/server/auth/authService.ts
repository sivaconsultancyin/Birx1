import { Request, Response, NextFunction } from 'express';
import { User, UserRole, Wallet } from '../../types.ts';
import { supabaseRepo, getSupabaseAdmin } from '../supabase/supabaseClient.ts';

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

export const authService = {
  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    return token || null;
  },

  async resolveUserFromToken(token: string): Promise<User | null> {
    if (!token) return null;
    const admin = getSupabaseAdmin();
    if (!admin) return null;

    try {
      const { data: { user: sbUser }, error } = await admin.auth.getUser(token);
      if (error || !sbUser) return null;
      return await supabaseRepo.getUserByAuthUserId(sbUser.id);
    } catch {
      return null;
    }
  },

  async getSessionFromToken(token: string): Promise<AuthSession | null> {
    const user = await this.resolveUserFromToken(token);
    if (!user) return null;
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token, user, wallet };
  },

  async switchRole(userId: string, newRole: UserRole): Promise<{ user: User; wallet: Wallet }> {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_ROLE_SWITCH !== 'true') {
      throw new Error('Role switching is disabled.');
    }
    const updatedUser = await supabaseRepo.updateUserRole(userId, newRole);
    if (!updatedUser) throw new Error('User not found');
    const wallet = await supabaseRepo.getWallet(userId);
    return { user: updatedUser, wallet };
  },

  canManageUser(actor: User, targetRole: UserRole): boolean {
    if (actor.role === 'OWNER') return true;
    if (actor.role === 'SUPER_ADMIN') return targetRole === 'ADMIN' || targetRole === 'PLAYER';
    if (actor.role === 'ADMIN') return targetRole === 'PLAYER';
    return false;
  }
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = authService.extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: Authentication token required' });

  const user = await authService.resolveUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });

  try {
    req.user = user;
    req.wallet = await supabaseRepo.getWallet(user.id);
    next();
  } catch (error: any) {
    return res.status(401).json({ error: error?.message || 'Unable to load authenticated account' });
  }
}

export function requirePlayerForGames(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'PLAYER') {
    return res.status(403).json({
      error: `Forbidden: Games are strictly accessible only to PLAYER accounts. Current role is ${req.user.role}.`
    });
  }
  next();
}

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
      });
    }
    next();
  };
}
