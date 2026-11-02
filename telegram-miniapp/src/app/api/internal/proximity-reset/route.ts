import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * ── /api/internal/proximity-reset ── Escape-hatch de PRUEBA (H11):
 * limpia los cooldowns de proximidad (loyalty/boost) para un usuario/negocio
 * para que el siguiente location/ping re-dispare el push sin esperar las 12h.
 *
 * Uso (God/testing): curl -X POST app.rabbitty.me/api/internal/proximity-reset
 *   -H "x-rating-secret: $RATING_INTERNAL_SECRET" -d '{userId, businessId?}'
 * businessId omitido → limpia TODOS los pares del usuario (útil en pruebas).
 *
 * Anti-fraude: solo limpia cooldowns — NO cambia preferencias, NO emite push.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.RATING_INTERNAL_SECRET || "";
  const provided = req.headers.get("x-rating-secret") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || "").trim();
  const businessId = String(body?.businessId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  try {
    const RedisMod = (await import("ioredis")).default;
    let client: import("ioredis").Redis | null = null;
    if (process.env.REDIS_URL) {
      client = new RedisMod(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 3000 });
      client.on("error", () => {});
    } else {
      return NextResponse.json({
        ok: false,
        error: "REDIS_URL no configurada en este entorno — los cooldowns viven en memoria local por instancia: espera el TTL (12h) o usa una venta limpia por Request SIN persistir datos de cooldown.",
        hint: "Set REDIS_URL o espera el vencimiento natural del cooldown (12h).",
      }, { status: 501 });
    }

    if (!client) return NextResponse.json({ ok: false, error: "Sin redis" }, { status: 500 });

    const patterns = businessId
      ? [`cd:push:loyalty:${userId}:${businessId}`, `cd:push:boost:${userId}:${businessId}`]
      : [`cd:push:loyalty:${userId}:*`, `cd:push:boost:${userId}:*`];

    let cleared = 0;
    for (const pattern of patterns) {
      const keys = pattern.includes("*") ? await client.keys(pattern) : [pattern];
      for (const key of keys) {
        const removed = await client.del(key);
        cleared += Number(removed || 0);
      }
    }
    await client.quit().catch(() => {});
    return NextResponse.json({ ok: true, cleared, userId, businessId: businessId || "*" });
  } catch (err: unknown) {
    console.error("[PROXIMITY_RESET] falló:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Error interno al resetear cooldown" }, { status: 500 });
  }
}
