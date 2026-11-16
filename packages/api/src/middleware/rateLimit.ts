import { TRPCError } from "@trpc/server";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;
if (redisUrl) {
  redis = new Redis(redisUrl);
}

export const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * ── Límites (configurables) ────────────────────────────────────────────────
 *
 * Historia: con un tope fijo de 60/min, el POS se pasaba de largo. La pantalla
 * dispara ~20 consultas al abrir, más invalidaciones al capturar y el preview de
 * membresía en cada cambio de carrito. Al quedar limitada una consulta, el POS
 * caía al precio de lista **sin avisar**: un socio podía acabar pagando completo.
 *
 * Reglas ahora:
 * - Lecturas (query): presupuesto amplio. Son baratas y de alta frecuencia.
 * - Escrituras (mutation): presupuesto más bajo (dinero, inventario, turnos).
 * - Todo configurable por entorno sin desplegar código.
 */
const WINDOW_S = Number(process.env.RATE_LIMIT_WINDOW_S ?? 60);
const WINDOW_MS = WINDOW_S * 1000;
const MAX_QUERY = Number(process.env.RATE_LIMIT_MAX_QUERY ?? 400);
const MAX_MUTATION = Number(process.env.RATE_LIMIT_MAX_MUTATION ?? 150);

function limitFor(kind: "query" | "mutation" | "subscription"): number {
  return kind === "mutation" ? MAX_MUTATION : MAX_QUERY;
}

/**
 * @param key     clave del cubo (`terminal:<sessionId>`, userId o anonymous)
 * @param max     tope de peticiones en la ventana
 */
export async function rateLimit(key: string, max = MAX_QUERY) {
  if (redis) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, WINDOW_S);
      }
      if (count > max) {
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

  if (entry.count >= max) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
  }

  entry.count++;
}

/** El middleware decide el cubo (usuario o terminal) y el presupuesto por tipo. */
export function rateLimitKey(ctx: { userId?: string | null; posAuth?: { method?: string; sessionId?: string | null } | null }) {
  return ctx.posAuth?.method === "terminal" && ctx.posAuth.sessionId
    ? `terminal:${ctx.posAuth.sessionId}`
    : ctx.userId ?? "anonymous";
}

export { limitFor };
