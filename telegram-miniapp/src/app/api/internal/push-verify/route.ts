import { NextRequest, NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/push/outbox";
import { db } from "@/db";
import { pushDevices, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * ── /api/internal/push-verify ── Verificador de push NOTIFS (H13).
 * GET  ?userId= → diagnóstico COMPLETO de un usuario:
 *      devices activos · outbox reciente (estado/attempts) · deliveries
 *      recién (canal+status+razón) · flags que revelan dónde se traba.
 * POST { action: "process", userId? } → EJECUTA processOutboxBatch AHORA
 *      (misma ruta que el cron/piggyback) y devuelve el summary — si está
 *      apagado el proveedor fue el worker quien falla, no el envío.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.RATING_INTERNAL_SECRET || "";
  const provided = req.headers.get("x-rating-secret") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId") || "";
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  try {
    const devices = await db
      .select({ id: pushDevices.id, platform: pushDevices.platform, isActive: pushDevices.isActive, updatedAt: pushDevices.updatedAt, token: pushDevices.token })
      .from(pushDevices)
      .where(eq(pushDevices.userId, userId));
    const [oubox] = await db.select({ pushRules: users.pushRules, muted: users.pushMutedCategories }).from(users).where(eq(users.id, userId)).limit(1);

    return NextResponse.json({
      ok: true,
      devices: devices.map((d) => ({
        platform: d.platform, active: d.isActive, letter: d.token?.slice(0, 8), updatedAt: d.updatedAt,
      })),
      pushRules: oubox?.pushRules ?? "{}",
      pushMutedCategories: oubox?.muted ?? "[]",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.RATING_INTERNAL_SECRET || "";
  const provided = req.headers.get("x-rating-secret") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (String(body?.action || "") !== "process") {
    return NextResponse.json({ error: "action=process requerido" }, { status: 400 });
  }

  // Forzar el ciclo del worker SIN el gating normal (diagnóstico determinista)
  const summary = await processOutboxBatch(25);
  return NextResponse.json({ ok: true, summary, ranAt: new Date().toISOString() });
}
