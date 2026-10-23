import Redis from 'ioredis';

/**
 * Rate limiter de ventana fija.
 * - Con REDIS_URL definido (p.ej. Railway) el contador se comparte entre todas las instancias.
 * - Sin REDIS_URL, o si Redis falla, cae a memoria local (por instancia) para no bloquear el servicio.
 */

const globalForRedis = globalThis as unknown as { __rabbittyRedis?: Redis | null };

function getRedis(): Redis | null {
  if (globalForRedis.__rabbittyRedis !== undefined) return globalForRedis.__rabbittyRedis;

  const url = process.env.REDIS_URL;
  if (!url) {
    globalForRedis.__rabbittyRedis = null;
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  // Evita "Unhandled error event" si Redis no responde; el fallback en memoria cubre el caso.
  client.on('error', (err) => console.error('[RateLimit] Redis error:', err.message));

  globalForRedis.__rabbittyRedis = client;
  return client;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();

  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const results = await redis.pipeline().incr(redisKey).ttl(redisKey).exec();
      const count = Number(results?.[0]?.[1] ?? 0);
      let ttl = Number(results?.[1]?.[1] ?? -1);
      // TTL -1 = clave sin expiración (primer hit o expire perdido): fija la ventana.
      if (ttl < 0) {
        await redis.expire(redisKey, windowSeconds);
        ttl = windowSeconds;
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (err) {
      console.error('[RateLimit] Redis falló, usando memoria:', err);
    }
  }

  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}
