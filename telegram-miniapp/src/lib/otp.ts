import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, peekRateLimit, clearRateLimit } from '@/lib/rateLimit';

/**
 * Rate limiting compartido entre instancias vía Redis (REDIS_URL).
 * Sin Redis o si falla, el helper cae a memoria local por instancia.
 */

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const res = await checkRateLimit(key, limit, Math.ceil(windowMs / 1000));
  return { ok: res.allowed, retryAfterSec: res.retryAfterSeconds };
}

/** Check de lockout SIN incrementar (para "¿demasiados intentos?"). */
export async function checkOnly(key: string, limit: number): Promise<boolean> {
  const { count } = await peekRateLimit(key);
  return count < limit;
}

export async function retryAfterSec(key: string): Promise<number> {
  const { retryAfterSeconds } = await peekRateLimit(key);
  return retryAfterSeconds;
}

export async function registerHit(key: string, limit: number, windowMs: number): Promise<void> {
  await rateLimit(key, limit, windowMs);
}

export async function resetLimit(key: string): Promise<void> {
  await clearRateLimit(key);
}

/** Hash determinista con pepper (OTP_PEPPER o TELEGRAM_BOT_TOKEN) — 2 args: identifier + code. */
export function hashOtp(identifier: string, code: string): string {
  const pepper = process.env.OTP_PEPPER || process.env.TELEGRAM_BOT_TOKEN || 'rabbitty';
  return crypto.createHmac('sha256', pepper).update(`${identifier}:${code}`).digest('hex');
}

export function getClientIp(req: NextRequest): string {
  // Railway/Vercel ponen la IP real en x-forwarded-for; confiar en el PRIMER proxy de la plataforma.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    // El primer valor puede ser spoofeado por el cliente; en plataformas con proxy
    // conocido Railway añade la IP real al final. Prefiere x-real-ip si existe.
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    return parts[parts.length - 1] || 'unknown';
  }
  return req.headers.get('x-real-ip') || 'unknown';
}
