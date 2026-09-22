import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

function clientKey(req: Request): string {
  const userId = req.user?.id;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return userId ? `u:${userId}` : `ip:${ip}`;
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = String(req.header('X-Request-Id') || '').slice(0, 100);
  const id = incoming || `req_${crypto.randomUUID()}`;
  res.setHeader('X-Request-Id', id);
  (req as any).requestId = id;
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https: wss:; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function rateLimit(options: { windowMs?: number; max?: number; keyPrefix?: string } = {}) {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const max = options.max ?? MAX_REQUESTS;
  const prefix = options.keyPrefix ?? 'global';
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${prefix}:${clientKey(req)}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count++;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please retry later.' });
    }
    next();
  };
}

export function validateJsonObject(req: Request, res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }
  next();
}

export function requireHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') return next();
  const forwarded = String(req.header('x-forwarded-proto') || '').split(',')[0].trim();
  const encrypted = req.secure || forwarded === 'https';
  if (!encrypted) return res.status(426).json({ error: 'HTTPS is required in production' });
  next();
}

export function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

setInterval(cleanupRateLimitBuckets, 5 * 60_000).unref();
