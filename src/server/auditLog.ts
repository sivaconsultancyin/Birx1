import crypto from 'node:crypto';
import type { Request } from 'express';
import { getSupabaseAdmin } from './supabase/supabaseClient.ts';

export async function writeAuditLog(req: Request, statusCode: number, action?: string) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    await admin.rpc('write_audit_log', {
      p_user_id: req.user?.id || null,
      p_action: action || `${req.method} ${req.path}`,
      p_method: req.method,
      p_path: req.path,
      p_status_code: statusCode,
      p_request_id: (req as any).requestId || null,
      p_ip_hash: ipHash,
      p_metadata: {}
    });
  } catch (error) {
    console.error('[AuditLog]', error);
  }
}

export function auditMutations(req: Request, res: any, next: any) {
  res.on('finish', () => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      void writeAuditLog(req, res.statusCode);
    }
  });
  next();
}
