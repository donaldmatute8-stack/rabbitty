import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { businessOffers, offerRedemptions, ownedBusinesses, users } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';
import { checkRateLimit } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/otp';
import { normalizeOfferCode } from '@rabbitty/api/services/offers';

/**
 * ── Validar un canje (comercio) ────────────────────────────────────────────
 *
 * Solo el dueño del negocio (o un ADMIN) puede validar el código. Si el código
 * venció, se devuelve el Bunz al Rabbitter, se restaura el respaldo y el stock:
 * un cupón vencido no puede costarle dinero a nadie.
 */
export async function POST(req: Request) {
  try {
    // Los códigos son de 6 caracteres: sin límite, una cuenta podría probar
    // miles por minuto. 30/min cubre un mostrador con fila y frena el barrido.
    const ip = getClientIp(req as unknown as NextRequest);
    const ipLimit = await checkRateLimit(`offer_validate_ip:${ip}`, 60, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMITED', error: 'Demasiados intentos seguidos. Espera un momento.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
      );
    }

    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, code: 'NEED_SESSION', error: 'Inicia sesión.' }, { status: 401 });
    }

    const userLimit = await checkRateLimit(`offer_validate:${caller.id}`, 30, 60);
    if (!userLimit.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMITED', error: 'Demasiados intentos seguidos. Espera un momento.' },
        { status: 429, headers: { 'Retry-After': String(userLimit.retryAfterSeconds) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const code = normalizeOfferCode(String(body?.code ?? ''));
    if (!code || code.length < 4) {
      return NextResponse.json({ success: false, code: 'BAD_CODE', error: 'Código inválido.' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(offerRedemptions)
        .where(eq(offerRedemptions.code, code))
        .limit(1)
        .for('update');
      if (!row) return { kind: 'error' as const, status: 404, code: 'NOT_FOUND', message: 'Código no encontrado.' };

      const [biz] = await tx
        .select()
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, row.businessId))
        .limit(1);
      if (!biz) return { kind: 'error' as const, status: 404, code: 'NO_BUSINESS', message: 'Negocio no encontrado.' };

      // Solo el comercio dueño (o un admin) valida.
      const isOwner = biz.ownerId && biz.ownerId === caller.id;
      if (!isOwner && caller.role !== 'ADMIN') {
        return { kind: 'error' as const, status: 403, code: 'FORBIDDEN', message: 'Este canje no es de tu negocio.' };
      }

      if (row.status === 'VALIDATED') {
        return { kind: 'ok' as const, already: true, row, businessName: biz.name, offerTitle: null };
      }
      if (row.status !== 'RESERVED') {
        return { kind: 'error' as const, status: 409, code: 'NOT_RESERVED', message: 'Este canje ya no está vigente.' };
      }

      const expired = new Date(row.expiresAt).getTime() <= Date.now();
      if (expired) {
        // Devolver: usuario + respaldo + stock + asiento REFUND
        await tx
          .update(users)
          .set({ totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - ${row.bunzCost})` })
          .where(eq(users.id, row.userId));
        await tx
          .update(ownedBusinesses)
          .set({ bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) + ${row.bunzCost}` })
          .where(eq(ownedBusinesses.id, row.businessId));
        await tx
          .update(businessOffers)
          .set({ stockUsed: sql`GREATEST(0, ${businessOffers.stockUsed} - 1)` })
          .where(eq(businessOffers.id, row.offerId));
        await tx
          .update(offerRedemptions)
          .set({ status: 'EXPIRED', updatedAt: new Date() })
          .where(eq(offerRedemptions.id, row.id));

        await recordLedgerTransaction(
          {
            payerSubjectId: `biz_${row.businessId}`,
            payeeSubjectId: `usr_${row.userId}`,
            amount: row.bunzCost,
            type: 'REFUND',
            referenceId: row.id,
            idempotencyKey: `offer_expired_${row.id}`,
            sandbox: Boolean(biz.sandbox),
            metadata: { offerId: row.offerId, code: row.code, reason: 'OFFER_CODE_EXPIRED' },
          },
          tx,
        );

        return {
          kind: 'error' as const,
          status: 409,
          code: 'EXPIRED',
          message: 'El código venció. Se devolvieron los Bunz al cliente.',
        };
      }

      const [updated] = await tx
        .update(offerRedemptions)
        .set({ status: 'VALIDATED', validatedAt: new Date(), validatedBy: caller.id, updatedAt: new Date() })
        .where(eq(offerRedemptions.id, row.id))
        .returning();

      const [offer] = await tx
        .select({ title: businessOffers.title })
        .from(businessOffers)
        .where(eq(businessOffers.id, row.offerId))
        .limit(1);

      return {
        kind: 'ok' as const,
        already: false,
        row: updated,
        businessName: biz.name,
        offerTitle: offer?.title ?? null,
        userId: row.userId,
      };
    });

    if (result.kind === 'error') {
      return NextResponse.json({ success: false, code: result.code, error: result.message }, { status: result.status });
    }

    if (!result.already && 'userId' in result && result.userId) {
      try {
        const { sendEcosystemNotification } = await import('@/lib/push/notify');
        await sendEcosystemNotification({
          userId: result.userId,
          title: '✅ Canje validado',
          message: `Disfruta "${result.offerTitle ?? 'tu canje'}" en ${result.businessName}.`,
          type: 'REWARD',
          route: '/history',
          pushData: { code: result.row.code },
          threadId: 'stock',
        });
      } catch (notifyError) {
        console.warn('[OFFER_VALIDATE] aviso al cliente falló:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyValidated: result.already,
      code: result.row.code,
      offerTitle: result.offerTitle,
      businessName: result.businessName,
      bunzCost: result.row.bunzCost,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OFFER_VALIDATE]', message);
    return NextResponse.json(
      { success: false, code: 'UNKNOWN', error: 'No pudimos validar el canje. Intenta de nuevo.' },
      { status: 500 },
    );
  }
}
