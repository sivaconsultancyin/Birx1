import { Request, Response, NextFunction } from 'express';
import { User, UserRole, Wallet } from '../../types.ts';
import { supabaseRepo, getSupabaseAdmin, getSupabasePublic } from '../supabase/supabaseClient.ts';

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

export const authService = {
  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7).trim();
    return null;
  },

  async sendOtp(mobile: string): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabasePublic();
    if (!supabase) throw new Error('Supabase Auth is not configured.');
    const clean = mobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) throw new Error('Invalid mobile number.');
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${clean}` });
    if (error) throw new Error(`OTP send failed: ${error.message}`);
    return { success: true, message: 'OTP sent successfully.' };
  },

  async verifyOtp(mobile: string, otp: string): Promise<AuthSession> {
    const supabase = getSupabasePublic();
    const admin = getSupabaseAdmin();
    if (!supabase || !admin) throw new Error('Supabase Auth is not configured.');
    const clean = mobile.replace(/\D/g, '').slice(-10);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${clean}`,
      token: otp,
      type: 'sms'
    });
    if (error || !data.user || !data.session) {
      throw new Error(`OTP verification failed: ${error?.message || 'Invalid OTP'}`);
    }

    let { data: dbUser } = await admin.from('users').select('*').eq('auth_user_id', data.user.id).maybeSingle();
    if (!dbUser) {
      const existing = await supabaseRepo.getUserByEmailOrMobile(`+91${clean}`);
      if (existing) {
        const { data: linked, error: linkError } = await admin
          .from('users')
          .update({ auth_user_id: data.user.id })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (linkError || !linked) throw new Error(`Auth profile linking failed: ${linkError?.message || 'unknown error'}`);
        dbUser = linked;
      } else {
        const created = await supabaseRepo.createUser({
          id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          mobile: `+91${clean}`,
          username: `Player_${clean.slice(-4)}`,
          role: 'PLAYER',
          parentId: undefined,
          vipTier: 'Bronze',
          isDemo: false,
          createdAt: new Date().toISOString()
        });
        const { data: linked, error: linkError } = await admin
          .from('users')
          .update({ auth_user_id: data.user.id })
          .eq('id', created.id)
          .select('*')
          .single();
        if (linkError || !linked) throw new Error(`Auth profile creation failed: ${linkError?.message || 'unknown error'}`);
        dbUser = linked;
      }
    }

    const user = await supabaseRepo.getUserById(dbUser.id);
    if (!user) throw new Error('Application user profile not found.');
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token: data.session.access_token, user, wallet };
  },

  async resolveUserFromToken(token: string): Promise<User | null> {
    if (!token) return null;
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data: { user: sbUser }, error } = await admin.auth.getUser(token);
    if (error || !sbUser) return null;
    const { data } = await admin.from('users').select('*').eq('auth_user_id', sbUser.id).maybeSingle();
    if (!data) return null;
    return supabaseRepo.getUserById(data.id);
  },

  canManageUser(actor: User, targetRole: UserRole): boolean {
    if (actor.role === 'OWNER') return true;
    if (actor.role === 'SUPER_ADMIN') return targetRole === 'ADMIN' || targetRole === 'PLAYER';
    if (actor.role === 'ADMIN') return targetRole === 'PLAYER';
    return false;
  }
};
// ---------------------------------------------------------------------
// EXPRESS MIDDLEWARES
// ---------------------------------------------------------------------

// 1. Authenticate user from Supabase token / session
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = authService.extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: Supabase access token required' });

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
