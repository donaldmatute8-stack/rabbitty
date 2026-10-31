import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { restaurantDb } from '@/db/restaurant';
import { ownedBusinesses, users, ledgerEntries } from '@/db/schema';
import { restaurants, branches, events } from '@rabbitty/database-restaurant/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * Confirmación GPS de presencia ("Sí, estoy en {comercio}").
 * Abre (o refresca) la presence-session, registra el check-in diario en ledger,
 * y emite señales CHECKIN_SCAN + CUSTOMER_ARRIVAL para el POS/Kiosko —
 * equivalente al check-in por escaneo, pero sin QR.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId || '');
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId requerido' }, { status: 400 });

    const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name, ownerId: ownedBusinesses.ownerId })
      .from(ownedBusinesses).where(sql`id = ${businessId} OR slug = ${businessId}`).limit(1);
    if (!biz) return NextResponse.json({ success: false, error: 'Negocio no encontrado' }, { status: 404 });

    const now = new Date();
    // 1. Abrir o refrescar sesión abierta en presenceSessions
    const [open] = await db.execute(
      sql`SELECT id FROM "presenceSessions" WHERE "userId" = ${caller.id} AND "businessId" = ${biz.id} AND "endedAt" IS NULL LIMIT 1`
    ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
    if (open) {
      await db.execute(sql`UPDATE "presenceSessions" SET "lastPingAt" = now(), "updatedAt" = now() WHERE id = ${open.id}`);
    } else {
      // Cerrar sesiones en otros negocios (se movió)
      await db.execute(sql`UPDATE "presenceSessions" SET "endedAt" = now(), "updatedAt" = now() WHERE "userId" = ${caller.id} AND "endedAt" IS NULL`);
      await db.execute(sql`INSERT INTO "presenceSessions" ("id", "userId", "businessId", "source", "startedAt", "lastPingAt")
        VALUES (gen_random_uuid(), ${caller.id}, ${biz.id}, 'gps', now(), now())`);
    }

    // 2. Registrar check-in diario en ledger + visitedBusinesses (igual que /api/business/checkin)
    // Día en America/Mexico_City (el server en Vercel corre en UTC — sin esto
    // el "día" del check-in cambiaba a las 6pm CDMX).
    try {
      const cdmxDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
      const idempotencyKey = `checkin_${biz.id}_${caller.id}_${cdmxDate}`;
      const [todayRow] = await db.select({ n: sql<number>`COUNT(*)` })
        .from(ledgerEntries)
        .where(and(
          eq(ledgerEntries.payeeSubjectId, `usr_${caller.id}`),
          eq(ledgerEntries.payerSubjectId, biz.id),
          eq(ledgerEntries.type, 'EARN'),
          eq(ledgerEntries.idempotencyKey, idempotencyKey),
        ));
      const alreadyToday = Number(todayRow?.n ?? 0) > 0;
      const inserted = await db.insert(ledgerEntries).values({
        payerSubjectId: biz.id,
        payeeSubjectId: `usr_${caller.id}`,
        amount: 0,
        currency: 'BUNZ',
        type: 'EARN',
        referenceId: biz.id,
        idempotencyKey,
        metadata: { kind: 'CHECK_IN', source: 'gps_confirm', businessId: biz.id, businessName: biz.name },
      }).onConflictDoNothing({ target: ledgerEntries.idempotencyKey }).returning();

      if (!alreadyToday && inserted.length > 0) {
        await db.update(users)
          .set({ visitedBusinesses: sql`COALESCE(${users.visitedBusinesses}, 0) + 1`, updatedAt: now })
          .where(eq(users.id, caller.id));
      }
    } catch (err) {
      console.error('[confirm-presence] ledger best-effort falló:', err instanceof Error ? err.message : err);
    }

    // 3. Señal para el feed del POS/Kiosko (business_interactions + events en restaurantDb)
    try {
      await db.execute(sql`INSERT INTO "business_interactions" (id, "userId", "businessId", action, channel, metadata)
        VALUES (${`ck_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`}, ${caller.id}, ${biz.id}, 'CHECKIN_SCAN', null,
          ${JSON.stringify({ kind: 'gps_confirm', at: now.toISOString() })}::jsonb)`);
    } catch (err) {
      console.error('[confirm-presence] interacción best-effort falló:', err instanceof Error ? err.message : err);
    }

    try {
      const [rest] = await restaurantDb.select().from(restaurants).where(eq(restaurants.businessId, biz.id)).limit(1);
      if (rest) {
        const [branch] = await restaurantDb.select().from(branches).where(eq(branches.restaurantId, rest.id)).limit(1);
        if (branch) {
          await restaurantDb.insert(events).values({
            branchId: branch.id,
            type: 'CUSTOMER_ARRIVAL',
            payload: {
              userId: caller.id,
              username: caller.username || 'Rabbitter',
              source: 'gps_confirm',
              arrivedAt: now.toISOString(),
            },
          });
        }
      }
    } catch (err) {
      console.error('[confirm-presence] evento CUSTOMER_ARRIVAL falló (POS/Kiosko no verá la llegada):', err instanceof Error ? err.message : err);
    }

    // 4. Aviso al dueño (anti-spam: solo si no hay aviso del mismo usuario en 12h)
    if (biz.ownerId && biz.ownerId !== caller.id) {
      try {
        const [recent] = await db.execute(
          sql`SELECT id FROM "notifications" WHERE "userId" = ${biz.ownerId} AND type = 'SYSTEM' AND "createdAt" >= now() - interval '12 hours'
              AND message ILIKE ${'%' + (caller.username || caller.id) + '%'} LIMIT 1`
        ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
        if (!recent) {
          await db.execute(sql`INSERT INTO "notifications" ("id", "userId", "title", "message", "type", "route")
            VALUES (gen_random_uuid()::text, ${biz.ownerId}, '📍 Un rabbitter confirmó presencia',
            ${`@${caller.username || 'rabbitter'} confirmó por GPS que está en ${biz.name}. Ya aparece en tu POS.`}, 'SYSTEM', '/pos')`);
        }
      } catch (err) {
        console.error('[confirm-presence] aviso al dueño falló:', err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({ success: true, businessName: biz.name });
  } catch (error) {
    console.error('[CONFIRM PRESENCE ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo registrar el check-in' }, { status: 500 });
  }
}
