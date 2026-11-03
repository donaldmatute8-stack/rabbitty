import Redis from "ioredis";

/**
 * ── chatRateLimit ── limiter HTTP para /api/chat/* (Fase 0.8 del plan).
 *
 * Regla del dictamen (M-*, "reutilizar primero"): el patrón ya existía en
 * packages/api/src/middleware/rateLimit.ts (Redis si REDIS_URL, memoria si no).
 * aquí está la contraparte autocontenida para rutas HTTP de la miniapp — no
 * trz trpc/Redis dependencjar. Limite por identidad autenticada (userId),
 * nunca por IP.
 */

const WINDOW_S = 60;

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  } catch {
    redis = null;
  }
}

export const chatRateCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * @param key identidad (p.ej. `chat_send:${userId}`)
 * @param max envíos permitidos por ventana
 */
export async function chatRateLimit(
  key: string,
  max: number,
): Promise<{ ok: true } | { ok: false; reason: "LIMIT_EXCEEDED" }> {
  if (redis) {
    try {
      const redisKey = `chat_ratelimit:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, WINDOW_S);
      if (count > max) return { ok: false, reason: "LIMIT_EXCEEDED" };
      return { ok: true };
    } catch (err) {
      console.warn("[chatRateLimit] Redis falló, cae a memoria:", err);
    }
  }

  const now = Date.now();
  const entry = chatRateCounts.get(key);
  if (!entry || now > entry.resetAt) {
    chatRateCounts.set(key, { count: 1, resetAt: now + WINDOW_S * 1000 });
    return { ok: true };
  }
  if (entry.count >= max) return { ok: false, reason: "LIMIT_EXCEEDED" };
  entry.count++;
  return { ok: true };
}
