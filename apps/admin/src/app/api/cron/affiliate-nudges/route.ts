import { NextRequest, NextResponse } from "next/server";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";
import { and, eq, isNull, asc } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * ── /api/cron/affiliate-nudges ── Notificaciones de afiliado (plan push §16).
 * P0: afiliados SIN username reclamado → campana en Admin (events del branch)
 * + in-app/push móvil vía outbox durable, CTA directo al perfil.
 * Dedupe diario (max 1 nudge por día por afiliado). Idempotente, no-fatal.
 * Autorización: CRON_SECRET (patrón expire-orders). Programar con GH Action
 * `affiliate-nudges-cron`. NUNCA emite a Rabbitters — solo dueños de negocio.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET || "";
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    (req.headers.get("x-cron-secret") || "");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const coreDb = getCoreDb();
    const restaurantDb = getRestaurantDb();
    const { users, ownedBusinesses, notificationsOutbox } = await import("@rabbitty/database-core/schema");
    const { events, branches, restaurants } = await import("@rabbitty/database-restaurant/schema");

    const missingRows = await coreDb
      .select({
        ownerId: users.id,
        businessId: ownedBusinesses.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(ownedBusinesses)
      .innerJoin(users, eq(users.id, ownedBusinesses.ownerId))
      .where(and(isNull(users.username), eq(ownedBusinesses.status, "VERIFIED")))
      .limit(200);

    const today = new Date().toISOString().slice(0, 10);
    let nudged = 0;

    for (const row of missingRows) {
      const nombre = [row.firstName, row.lastName].filter(Boolean).join(" ") || "afiliado";

      // 1) Push/in-app móvil del dueño (outbox core — dedupe diario)
      await coreDb
        .insert(notificationsOutbox)
        .values({
          userId: row.ownerId,
          type: "AFFILIATE_NUDGE",
          title: "Reclama tu usuario en Rabbitty",
          message: `Tu cuenta de negocio (${nombre}) no ha reclamado su username. Reclámalo en App → Perfil: es el @handle que tus clientes verán al pagarte.`,
          route: "https://telegram.rabbitty.me/profile",
          data: { kind: "username_claim", date: today },
          dedupeKey: `affiliate_nudge_username:${row.ownerId}:${today}`,
          priority: "normal",
        })
        .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });

      // 2) Campana Admin (events del branch principal del restaurante del negocio)
      const [bizRest] = await restaurantDb
        .select({ id: restaurants.id })
        .from(restaurants)
        .where(eq(restaurants.businessId, row.businessId))
        .limit(1);
      if (bizRest) {
        const [bizBranch] = await restaurantDb
          .select({ branchId: branches.id })
          .from(branches)
          .where(and(eq(branches.restaurantId, bizRest.id), eq(branches.isActive, true)))
          .orderBy(asc(branches.createdAt))
          .limit(1);
        if (bizBranch) {
          await restaurantDb
            .insert(events)
            .values({
              branchId: bizBranch.branchId,
              type: "AFFILIATE_NUDGE",
              payload: {
                title: "Reclama tu username",
                message: `El negocio ${nombre} no ha reclamado su @username — se refleja en el ticket y el portal. Asígnalo desde Admin → Perfil o pídelo en soporte.`,
              },
            })
            .catch(() => undefined);
        }
      }
      nudged += 1;
    }

    return NextResponse.json({ ok: true, date: today, scanned: missingRows.length, nudged });
  } catch (err: unknown) {
    console.error("[AFFILIATE_NUDGES] falló:", err instanceof Error ? err.stack || err.message : err);
    return NextResponse.json({ ok: false, error: "Error interno del nudge" }, { status: 500 });
  }
}
