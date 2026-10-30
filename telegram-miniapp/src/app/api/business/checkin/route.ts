import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, ledgerEntries } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * Check-in REAL en el negocio (QR de mostrador / póster / kiosko).
 * Registra la visita en ledger (type EARN de 0 no sirve; usamos VISIT vía metadata)
 * e incrementa visitedBusinesses del usuario. Anti-abuso: 1 check-in por negocio por día.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId || '');
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId requerido' }, { status: 400 });

    const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
      .from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
    if (!biz) return NextResponse.json({ success: false, error: 'Negocio no encontrado' }, { status: 404 });

    // Anti-abuso: 1 check-in por negocio por día (ledger como fuente)
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [todayRow] = await db.select({ n: sql<number>`COUNT(*)` })
      .from(ledgerEntries)
      .where(and(
        eq(ledgerEntries.payeeSubjectId, `usr_${caller.id}`),
        eq(ledgerEntries.payerSubjectId, biz.id),
        eq(ledgerEntries.type, 'EARN'),
        eq(ledgerEntries.idempotencyKey, `checkin_${biz.id}_${caller.id}_${dayStart.toISOString().slice(0, 10)}`),
        gte(ledgerEntries.createdAt, dayStart),
      ));
    if (Number(todayRow?.n ?? 0) > 0) {
      return NextResponse.json({ success: true, checkIn: 'already', message: 'Ya hiciste check-in hoy aquí 🐰' });
    }

    // Registro atómico: ledger con clave única diaria + contador de visitas
    const idempotencyKey = `checkin_${biz.id}_${caller.id}_${dayStart.toISOString().slice(0, 10)}`;
    const inserted = await db.insert(ledgerEntries).values({
      payerSubjectId: biz.id,
      payeeSubjectId: `usr_${caller.id}`,
      amount: 0, // check-in no mintea Bunz por sí mismo (el cashback llega con el consumo)
      currency: 'BUNZ',
      type: 'EARN',
      referenceId: biz.id,
      idempotencyKey,
      metadata: { kind: 'CHECK_IN', businessId: biz.id, businessName: biz.name },
    }).onConflictDoNothing({ target: ledgerEntries.idempotencyKey }).returning();

    if (inserted.length > 0) {
      await db.update(users)
        .set({ visitedBusinesses: sql`COALESCE(${users.visitedBusinesses}, 0) + 1`, updatedAt: new Date() })
        .where(eq(users.id, caller.id));
    }

    // ── Sesión de permanencia (unifica scan y GPS) ──
    try {
      const [openS] = await db.execute(
        sql`SELECT id FROM "presenceSessions" WHERE "userId" = ${caller.id} AND "businessId" = ${biz.id} AND "endedAt" IS NULL LIMIT 1`
      ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
      if (openS) {
        await db.execute(sql`UPDATE "presenceSessions" SET "lastPingAt" = now(), "updatedAt" = now() WHERE id = ${openS.id}`);
      } else {
        await db.execute(sql`UPDATE "presenceSessions" SET "endedAt" = now(), "updatedAt" = now() WHERE "userId" = ${caller.id} AND "endedAt" IS NULL`);
        await db.execute(sql`INSERT INTO "presenceSessions" ("id", "userId", "businessId", "source", "startedAt", "lastPingAt")
          VALUES (gen_random_uuid()::text, ${caller.id}, ${biz.id}, 'scan', now(), now())`);
      }
    } catch { /* best-effort */ }

        // ── Señal de presencia SIEMPRE (aunque el check-in diario sea 'already'): el POS
    // y el Kiosko pollan estas interacciones — sin esto un re-escaneo no actualizaría nada. ──
    try {
      await db.execute(sql`INSERT INTO "business_interactions" (id, "userId", "businessId", action, channel, metadata)
        VALUES (${`ck_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`}, ${caller.id}, ${biz.id}, 'CHECKIN_SCAN', null, ${JSON.stringify({ kind: inserted.length > 0 ? 'registered' : 'repeat', at: new Date().toISOString() })}::jsonb)`);
    } catch { /* best-effort */ }

    return NextResponse.json({ success: true, checkIn: inserted.length > 0 ? 'registered' : 'already', businessName: biz.name });
  } catch (error) {
    console.error('[CHECKIN ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo registrar el check-in' }, { status: 500 });
  }
}
