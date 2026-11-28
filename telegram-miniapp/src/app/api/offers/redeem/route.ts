import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db';
import { businessOffers, offerRedemptions, ownedBusinesses, users } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';
import {
  generateOfferCode,
  isOfferLive,
  offerAvailableUnits,
  offerCodeExpiry,
} from '@rabbitty/api/services/offers';

/**
 * ── Canjear una oferta ─────────────────────────────────────────────────────
 *
 * Una sola transacción en CORE: usuario + respaldo del negocio + oferta +
 * redención + asiento del ledger. El precio vive en la oferta (nunca lo manda
 * el cliente) y se vuelve a validar todo dentro del lock.
 *
 * El canje nace RESERVED con un código; el comercio lo valida en el local.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, code: 'NEED_SESSION', error: 'Inicia sesión para canjear.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const offerId = String(body?.offerId ?? '').trim();
    const clientKey = String(body?.idempotencyKey ?? '').trim().slice(0, 80);
    if (!offerId) {
      return NextResponse.json({ success: false, code: 'NO_OFFER', error: 'Oferta inválida.' }, { status: 400 });
    }

    const idempotencyKey = `offer_redeem:${caller.id}:${offerId}:${clientKey || 'default'}`;

    const result = await db.transaction(async (tx) => {
      const [prior] = await tx
        .select()
        .from(offerRedemptions)
        .where(eq(offerRedemptions.idempotencyKey, idempotencyKey))
        .limit(1);
      if (prior) return { kind: 'ok' as const, row: prior };

      const [offer] = await tx
        .select()
        .from(businessOffers)
        .where(eq(businessOffers.id, offerId))
        .limit(1)
        .for('update');
      if (!offer) return { kind: 'error' as const, status: 404, code: 'NO_OFFER', message: 'La oferta ya no existe.' };
      if (!isOfferLive(offer)) {
        return { kind: 'error' as const, status: 409, code: 'OFFER_CLOSED', message: 'Esta oferta ya no está disponible.' };
      }

      const [biz] = await tx
        .select()
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, offer.businessId))
        .limit(1)
        .for('update');
      if (!biz) return { kind: 'error' as const, status: 404, code: 'NO_BUSINESS', message: 'Negocio no encontrado.' };

      const cost = Number(offer.bunzCost);
      const available = offerAvailableUnits(offer, Number(biz.bunzBalance || 0));
      if (available < 1) {
        return { kind: 'error' as const, status: 409, code: 'SOLD_OUT', message: 'Se agotó esta oferta.' };
      }

      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, caller.id))
        .limit(1)
        .for('update');
      if (!lockedUser) return { kind: 'error' as const, status: 404, code: 'NO_USER', message: 'Usuario no encontrado.' };

      const balance = Number(lockedUser.totalBunzEarned || 0) - Number(lockedUser.totalBunzSpent || 0);
      if (balance < cost) {
        return {
          kind: 'error' as const,
          status: 409,
          code: 'INSUFFICIENT_BUNZ',
          message: `Te faltan ${cost - balance} Bunz para esta oferta.`,
        };
      }

      if (Number(offer.perUserLimit || 1) > 0) {
        const [{ n }] = (await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(offerRedemptions)
          .where(
            and(
              eq(offerRedemptions.userId, caller.id),
              eq(offerRedemptions.offerId, offer.id),
              inArray(offerRedemptions.status, ['RESERVED', 'VALIDATED']),
            ),
          )) as Array<{ n: number }>;
        if (Number(n) >= Number(offer.perUserLimit || 1)) {
          return {
            kind: 'error' as const,
            status: 409,
            code: 'LIMIT_REACHED',
            message: 'Ya canjeaste esta oferta.',
          };
        }
      }

      // 1. Debitar al Rabbitter
      await tx
        .update(users)
        .set({ totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${cost}`, updatedAt: new Date() })
        .where(eq(users.id, lockedUser.id));

      // 2. Consumir respaldo del negocio (condicional, sin sobregiro)
      const consumed = await tx
        .update(ownedBusinesses)
        .set({ bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) - ${cost}` })
        .where(
          and(
            eq(ownedBusinesses.id, biz.id),
            sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) >= ${cost}`,
          ),
        )
        .returning({ remaining: ownedBusinesses.bunzBalance });
      if (consumed.length === 0) {
        throw new Error('BUSINESS_BACKING_INSUFFICIENT');
      }

      // 3. Consumir stock
      await tx
        .update(businessOffers)
        .set({ stockUsed: sql`${businessOffers.stockUsed} + 1`, updatedAt: new Date() })
        .where(eq(businessOffers.id, offer.id));

      // 4. Redención con código único (reintenta si choca)
      let code = generateOfferCode();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const [clash] = await tx
          .select({ id: offerRedemptions.id })
          .from(offerRedemptions)
          .where(eq(offerRedemptions.code, code))
          .limit(1);
        if (!clash) break;
        code = generateOfferCode();
      }

      const [row] = await tx
        .insert(offerRedemptions)
        .values({
          id: randomUUID(),
          offerId: offer.id,
          businessId: offer.businessId,
          userId: caller.id,
          code,
          bunzCost: cost,
          status: 'RESERVED',
          expiresAt: offerCodeExpiry(24),
          idempotencyKey,
        })
        .returning();

      // 5. Asiento canónico ADR-008: usr_ paga → biz_ recibe
      await recordLedgerTransaction(
        {
          payerSubjectId: `usr_${caller.id}`,
          payeeSubjectId: `biz_${offer.businessId}`,
          amount: cost,
          type: 'SPEND',
          referenceId: row.id,
          idempotencyKey: `offer_redemption_${row.id}`,
          sandbox: Boolean(biz.sandbox),
          metadata: { offerId: offer.id, code, title: offer.title, source: 'STOCK' },
        },
        tx,
      );

      return { kind: 'ok' as const, row, offer, businessName: biz.name, ownerId: biz.ownerId ?? null };
    });

    if (result.kind === 'error') {
      return NextResponse.json({ success: false, code: result.code, error: result.message }, { status: result.status });
    }

    // Aviso al comercio: hay un canje esperando validación.
    if (result.ownerId) {
      try {
        const { sendEcosystemNotification } = await import('@/lib/push/notify');
        await sendEcosystemNotification({
          userId: result.ownerId,
          title: '🎟️ Nuevo canje por validar',
          message: `${caller.username || 'Un Rabbitter'} canjeó "${result.offer?.title ?? 'una oferta'}" (${result.offer?.bunzCost ?? 0} Bunz). Código ${result.row.code}.`,
          type: 'SYSTEM',
          route: '/business/scan',
          pushData: { redemptionId: result.row.id, code: result.row.code },
          threadId: 'stock',
        });
      } catch (notifyError) {
        console.warn('[OFFER_REDEEM] aviso al comercio falló:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      redemptionId: result.row.id,
      code: result.row.code,
      expiresAt: result.row.expiresAt,
      offer: result.offer ? { id: result.offer.id, title: result.offer.title, bunzCost: result.offer.bunzCost } : null,
      businessName: 'businessName' in result ? result.businessName : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OFFER_REDEEM]', message);
    return NextResponse.json(
      { success: false, code: 'UNKNOWN', error: 'No pudimos completar el canje. Intenta de nuevo.' },
      { status: 500 },
    );
  }
}
