import crypto from 'node:crypto';
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

/**
 * Normalizes input phone numbers to 10-digit national number.
 * Handles '+91', '91' prefix, leading '0', spaces, and dashes.
 */
export function normalizeMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length !== 10) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }
  return digits;
}

/**
 * Formats a normalized mobile to E.164 (+91XXXXXXXXXX)
 */
export function formatE164Mobile(raw: string): string {
  return `+91${normalizeMobile(raw)}`;
}

/**
 * Deterministically computes the Supabase auth email for an identifier.
 * - If identifier contains '@', it is treated as a direct email address.
 * - If identifier is a mobile number, it is canonicalized to 10 digits -> <10digits>@auth.brix.games
 */
export function getAuthEmail(identifier: string): string {
  const trimmed = String(identifier || '').trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const cleanMobile = normalizeMobile(trimmed);
  return `${cleanMobile}@auth.brix.games`;
}

export const authService = {
  async logout(token: string): Promise<void> {
    const admin = getSupabaseAdmin();
    if (admin && token) {
      await admin.auth.admin.signOut(token).catch(() => undefined);
    }
  },

  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return token;
    }
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith('brix_access_token='));
    return match ? decodeURIComponent(match.slice('brix_access_token='.length)).trim() : null;
  },

  async resolveUserFromToken(token: string): Promise<User | null> {
    if (!token) return null;
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    try {
      const { data: { user: sbUser }, error } = await admin.auth.getUser(token);
      if (error || !sbUser) return null;
      return await supabaseRepo.getUserByAuthId(sbUser.id);
    } catch {
      return null;
    }
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
    const publicClient = getSupabasePublic();
    if (!publicClient) throw new Error('Authentication service is not configured.');
    const email = getAuthEmail(identifier);
    const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) throw new Error('Invalid mobile number or password.');
    const user = await supabaseRepo.getUserByAuthId(data.user.id);
    if (!user) throw new Error('Authenticated account is not linked to a Brix user.');
    const wallet = await supabaseRepo.getWallet(user.id);
    return { token: data.session.access_token, user, wallet };
  },

  async register(mobile: string, username: string, password: string, _role: UserRole = 'PLAYER', parentId?: string): Promise<AuthSession> {
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
    const cleanMobile = normalizeMobile(mobile);
    const formattedMobile = formatE164Mobile(mobile);
    const existing = await supabaseRepo.getUserByEmailOrMobile(cleanMobile);
    if (existing) throw new Error('An account with this mobile number already exists.');
    const admin = getSupabaseAdmin();
    const publicClient = getSupabasePublic();
    if (!admin || !publicClient) throw new Error('Authentication service is not configured.');
    const email = getAuthEmail(cleanMobile);
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { mobile: formattedMobile, username }
    });
    if (authError || !authData.user) throw new Error(authError?.message || 'Unable to create authentication account.');
    try {
      const user = await supabaseRepo.createUser({
        id: `usr_${crypto.randomUUID()}`,
        mobile: formattedMobile,
        email,
        username,
        role: _role,
        parentId,
        vipTier: 'Bronze',
        isDemo: false,
        createdAt: new Date().toISOString()
      }, authData.user.id);
      const { error: linkError } = await admin.from('users').update({ auth_user_id: authData.user.id }).eq('id', user.id);
      if (linkError) throw linkError;
      const { data: sessionData, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
      if (signInError || !sessionData.session) throw signInError || new Error('Sign-in failed');
      const wallet = await supabaseRepo.getWallet(user.id);
      return { token: sessionData.session.access_token, user, wallet };
    } catch (error) {
      await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
      throw new Error(error instanceof Error ? error.message : 'Unable to create account.');
    }
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
