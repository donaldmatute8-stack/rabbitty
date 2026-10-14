import { NextRequest } from 'next/server';
import crypto from 'crypto';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function cleanup() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  if (buckets.size > 10000) {
    cleanup();
  }

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  return { ok: true, retryAfterSec: 0 };
}

export function retryAfterSec(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) return 0;
  return Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}

export function checkOnly(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) return true;
  return bucket.count < limit;
}

export function registerHit(key: string, limit: number, windowMs: number): void {
  rateLimit(key, limit + 1, windowMs);
}

export function resetLimit(key: string): void {
  buckets.delete(key);
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function hashOtp(email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email}:${code}:${process.env.OTP_PEPPER || process.env.TELEGRAM_BOT_TOKEN || 'rabbitty'}`)
    .digest('hex');
}