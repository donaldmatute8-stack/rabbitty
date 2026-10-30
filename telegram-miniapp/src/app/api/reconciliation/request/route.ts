import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { reconciliationRequests, ownedBusinesses, ledgerEntries, users, pendingVaults, notifications } from '@/db/schema';
import { orders, branches, restaurants } from '@rabbitty/database-restaurant/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MAX_OPEN_PER_DAY = 3;

/**
 * El Rabbitter reclama una recompensa no entregada (por folio del ticket).
 * - Solo el COMPRADOR de la orden puede reclamar.
 * - 1 conciliación por orden (UNIQUE) · máx 3 abiertas en 24h (atómico en tx).
 * - Monto SNAPSHOT calculado por el servidor: expected − credited − pending.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const folio = String(body?.folio || '').trim();
    const note = String(body?.note || '').trim();
    if (folio.length < 8 || note.length < 5) {
      return NextResponse.json({ error: 'Folio y motivo (mín. 5 caracteres) son obligatorios' }, { status: 400 });
    }

    const prefix = folio.replace(/[^A-Za-z0-9-]/g, '').toLowerCase();
    const [order] = await db.select().from(orders)
      .where(sql`lower(id) LIKE ${prefix + '%'}`)
      .orderBy(sql`length(id)`)
      .limit(1);
    if (!order) return NextResponse.json({ error: 'Orden no encontrada con ese folio' }, { status: 404 });
    if (order.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'La orden aún no está cobrada y confirmada en caja' }, { status: 400 });
    }

    if (!order.customerId || order.customerId !== caller.id) {
      return NextResponse.json({ error: 'Solo el comprador de esta orden puede pedir la conciliación' }, { status: 403 });
    }

    const [br] = await db.select({ restaurantId: branches.restaurantId }).from(branches)
      .where(eq(branches.id, order.branchId)).limit(1);
    let businessId: string | null = null;
    if (br?.restaurantId) {
      const [rest] = await db.select({ businessId: restaurants.businessId }).from(restaurants)
        .where(eq(restaurants.id, br.restaurantId)).limit(1);
      businessId = rest?.businessId || null;
    }
    if (!businessId) return NextResponse.json({ error: 'No se pudo resolver el negocio de la orden' }, { status: 400 });

    try {
      const result = await db.transaction(async (tx) => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [openCount] = await tx.select({ n: sql<number>`count(*)::int` })
          .from(reconciliationRequests)
          .where(and(
            eq(reconciliationRequests.userId, caller.id),
            gte(reconciliationRequests.createdAt, dayAgo),
            sql`${reconciliationRequests.status} IN ('PENDING_AFFILIATE','AFFILIATE_APPROVED','AFFILIATE_REJECTED','PENDING_GOD','DELIVERY_PROCESSING')`,
          ));
        if ((openCount?.n ?? 0) >= MAX_OPEN_PER_DAY) {
          throw new Error('Límite de 3 conciliaciones abiertas en 24h alcanzado');
        }

        const [biz] = await tx.select({ rewardPercentage: ownedBusinesses.rewardPercentage })
          .from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId!)).limit(1);
        const rewardPercentage = biz?.rewardPercentage ?? 20;
        const expected = Math.max(0, Math.floor(Number(order.total || 0) * (rewardPercentage / 100)));

        const keys = [`pos_rwd_${order.id}`, `claim_ticket_${order.id}`];
        const creditedRows = await tx.select({ amount: ledgerEntries.amount }).from(ledgerEntries)
          .where(and(
            sql`${ledgerEntries.idempotencyKey} = ANY(${keys})`,
            eq(ledgerEntries.type, 'EARN'),
          ));
        const credited = creditedRows.reduce((s: number, r: { amount: number | null }) => s + Number(r.amount || 0), 0);

        const [vaultRow] = await tx
          .select({ total: sql<number>`COALESCE(SUM("bunzAmount"), 0)` })
          .from(pendingVaults)
          .where(and(eq(pendingVaults.orderId, order.id), sql`status != 'CLAIMED'`));
        const pending = Number(vaultRow?.total ?? 0);

        const claimed = Math.max(0, expected - credited - pending);
        if (claimed <= 0) {
          throw new Error('Esta orden ya tiene sus Bunz acreditados o en camino — nada por conciliar');
        }

        const [created] = await tx.insert(reconciliationRequests).values({
          orderId: order.id,
          userId: caller.id,
          businessId,
          branchId: order.branchId,
          expectedBunz: expected,
          creditedBunz: credited,
          pendingBunz: pending,
          claimedBunz: claimed,
          rewardRuleRef: `rewardPercentage:${rewardPercentage}`,
          note,
          idempotencyKey: `pos_rwd_${order.id}`,
        }).onConflictDoNothing({ target: reconciliationRequests.orderId }).returning();

        if (!created) throw new Error('Ya existe una conciliación para esta orden');
        return created;
      });

      try {
        const [biz] = await db.select({ ownerId: ownedBusinesses.ownerId, name: ownedBusinesses.name })
          .from(ownedBusinesses).where(eq(ownedBusinesses.id, result.businessId)).limit(1);
        const { sendEcosystemNotification } = await import('@/lib/push/notify');
        if (biz?.ownerId) {
          await sendEcosystemNotification({
            userId: biz.ownerId,
            title: '⚖️ Un cliente pidió una conciliación',
            message: `Reclama ${result.claimedBunz} Bunz de una compra de $${order.total} (ticket ${order.id.slice(-4).toUpperCase()}). Revísala en Admin → Conciliaciones.`,
            type: 'SYSTEM',
            route: '/dashboard',
          });
        }
        const godRows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
        for (const g of godRows) {
          await db.insert(notifications).values({
            id: crypto.randomUUID(),
            userId: g.id,
            title: '⚖️ Conciliación solicitada (registro)',
            message: `${caller.username || 'Rabbitter'} reclama ${result.claimedBunz} Bunz de ${biz?.name || 'negocio'} — folio ${result.orderId.slice(0, 8).toUpperCase()}-${result.orderId.slice(8, 9).toUpperCase()}`,
            type: 'SYSTEM',
          });
        }
      } catch (nErr) {
        console.error('[RECONCILIATION notify]', nErr);
      }

      return NextResponse.json({ success: true, request: result });
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : '';
      return NextResponse.json({ error: msg || 'No se pudo crear la conciliación' }, { status: 400 });
    }
  } catch (error) {
    console.error('[RECONCILIATION REQUEST ERROR]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
