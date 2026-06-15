import { TRPCError } from "@trpc/server";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;
if (redisUrl) {
  redis = new Redis(redisUrl);
}

export const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_S = 60;
const WINDOW_MS = WINDOW_S * 1000;
const MAX_REQUESTS = 60;

export async function rateLimit(userId: string | null | undefined) {
  const key = userId ?? "anonymous";

  if (redis) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, WINDOW_S);
      }
      if (count > MAX_REQUESTS) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
      }
      return;
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      console.error("Redis rate limiting error, falling back to memory:", err);
    }
  }

  // Memory fallback
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
  }

  entry.count++;
}
