import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";
import { inviteNextWaiter } from "@rabbitty/api/services/rabbitChair";
import { sendRabbitChairInvite } from "@rabbitty/api/services/rabbitChairDrop";

export const runtime = "nodejs";

/**
 * ── Cron: invitaciones de la lista de espera de La Silla ───────────────────
 * Recorre las activaciones LIVE con lugar libre y fila pendiente, e invita al
 * primero de cada una (push con 10 minutos para tomarlo).
 *
 * Sin este cron la fila avanza solo cuando hay un POS abierto consultando.
 *
 * GET /api/cron/rabbit-chair-waitlist  (Authorization: Bearer CRON_SECRET)
 */
export async function GET(req: NextRequest) {
  // Sin secreto configurado, "Bearer undefined" no debe pasar.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getRestaurantDb();

  const rows = (await db.execute(sql`
    SELECT a."id" AS id, a."businessId" AS "businessId", a."branchId" AS "branchId", a."name" AS name
      FROM "rabbitChairActivations" a
     WHERE a."status" = 'LIVE'
       AND EXISTS (
         SELECT 1 FROM "rabbitChairSlots" s
          WHERE s."activationId" = a."id" AND s."status" = 'FREE'
       )
       AND EXISTS (
         SELECT 1 FROM "rabbitChairWaitlist" w
          WHERE w."activationId" = a."id" AND w."status" = 'WAITING'
       )
     LIMIT 100
  `)) as any;
  const activations = (rows?.rows ?? rows ?? []) as Array<{
    id: string;
    businessId: string;
    branchId?: string | null;
    name: string;
  }>;

  let invited = 0;
  let pushed = 0;

  for (const activation of activations) {
    try {
      const waiter = await inviteNextWaiter(db as any, activation.id);
      if (!waiter) continue;
      invited += 1;
      if (waiter.userId) {
        const ok = await sendRabbitChairInvite(waiter.userId, {
          businessId: activation.businessId,
          name: activation.name,
          branchId: activation.branchId ?? null,
        });
        if (ok) pushed += 1;
      }
    } catch (err) {
      console.warn("[rabbit-chair-waitlist] error:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    activations: activations.length,
    invited,
    pushed,
  });
}
