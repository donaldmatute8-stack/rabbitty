import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db';
import { businessOffers, offerRedemptions, ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

/**
 * ── Ofertas del comercio (Stock) ───────────────────────────────────────────
 * Un negocio (POS o Lite) publica lo que se compromete a honrar con Bunz.
 * La disponibilidad visible es `min(stock, floor(bunzBalance / bunzCost))`.
 */

async function resolveBusiness(callerId: string, role: string | null | undefined, businessIdFromQuery?: string | null) {
  if (businessIdFromQuery && role === 'ADMIN') {
    const [biz] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, businessIdFromQuery)).limit(1);
    return biz ?? null;
  }
  const [biz] = await db
    .select()
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.ownerId, callerId))
    .limit(1);
  return biz ?? null;
}

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'Inicia sesión.' }, { status: 401 });

    const url = new URL(req.url);
    const biz = await resolveBusiness(caller.id, caller.role, url.searchParams.get('businessId'));
    if (!biz) return NextResponse.json({ success: false, error: 'No encontramos tu negocio.' }, { status: 404 });

    const offers = await db
      .select()
      .from(businessOffers)
      .where(eq(businessOffers.businessId, biz.id))
      .orderBy(desc(businessOffers.createdAt));

    const ids = offers.map((o) => o.id);
    const counts = ids.length
      ? await db
          .select({
            offerId: offerRedemptions.offerId,
            status: offerRedemptions.status,
            n: sql<number>`count(*)::int`,
          })
          .from(offerRedemptions)
          .where(inArray(offerRedemptions.offerId, ids))
          .groupBy(offerRedemptions.offerId, offerRedemptions.status)
      : [];

    const byOffer = new Map<string, Record<string, number>>();
    for (const row of counts) {
      const current = byOffer.get(row.offerId) ?? {};
      current[row.status] = Number(row.n);
      byOffer.set(row.offerId, current);
    }

    return NextResponse.json({
      success: true,
      business: { id: biz.id, name: biz.name, bunzBalance: biz.bunzBalance, participationModel: biz.participationModel },
      offers: offers.map((o) => ({
        ...o,
        canjesDisponibles: Math.max(
          0,
          Math.min(
            Number(o.stockTotal) - Number(o.stockUsed),
            Math.floor(Number(biz.bunzBalance || 0) / Math.max(1, Number(o.bunzCost))),
          ),
        ),
        redemptions: byOffer.get(o.id) ?? {},
      })),
    });
  } catch (error: unknown) {
    console.error('[BUSINESS_OFFERS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'No pudimos cargar tus ofertas.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'Inicia sesión.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const biz = await resolveBusiness(caller.id, caller.role, body?.businessId ?? null);
    if (!biz) return NextResponse.json({ success: false, error: 'No encontramos tu negocio.' }, { status: 404 });

    const title = String(body?.title ?? '').trim().slice(0, 80);
    const bunzCost = Math.round(Number(body?.bunzCost ?? 0));
    const stockTotal = Math.round(Number(body?.stockTotal ?? 0));
    const perUserLimit = Math.max(1, Math.round(Number(body?.perUserLimit ?? 1)));
    if (title.length < 3) {
      return NextResponse.json({ success: false, error: 'El título necesita al menos 3 caracteres.' }, { status: 400 });
    }
    if (!Number.isFinite(bunzCost) || bunzCost < 1) {
      return NextResponse.json({ success: false, error: 'El precio en Bunz debe ser mayor a 0.' }, { status: 400 });
    }
    if (!Number.isFinite(stockTotal) || stockTotal < 1) {
      return NextResponse.json({ success: false, error: 'Necesitas al menos 1 unidad de stock.' }, { status: 400 });
    }

    const validUntil = body?.validUntil ? new Date(body.validUntil) : null;
    const patch = {
      title,
      description: body?.description ? String(body.description).slice(0, 500) : null,
      imageUrl: body?.imageUrl ? String(body.imageUrl).slice(0, 500) : null,
      bunzCost,
      fiatValue: body?.fiatValue != null ? Number(body.fiatValue) : null,
      stockTotal,
      perUserLimit,
      validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
      status: 'ACTIVE',
      updatedAt: new Date(),
    };

    const id = String(body?.id ?? '').trim();
    if (id) {
      const [existing] = await db
        .select({ id: businessOffers.id, businessId: businessOffers.businessId, stockUsed: businessOffers.stockUsed })
        .from(businessOffers)
        .where(eq(businessOffers.id, id))
        .limit(1);
      if (!existing || existing.businessId !== biz.id) {
        return NextResponse.json({ success: false, error: 'Oferta no encontrada.' }, { status: 404 });
      }
      if (stockTotal < Number(existing.stockUsed)) {
        return NextResponse.json(
          { success: false, error: `Ya se canjearon ${existing.stockUsed}; el stock no puede ser menor.` },
          { status: 400 },
        );
      }
      const [updated] = await db
        .update(businessOffers)
        .set(patch)
        .where(eq(businessOffers.id, id))
        .returning();
      return NextResponse.json({ success: true, offer: updated });
    }

    const [created] = await db
      .insert(businessOffers)
      .values({
        id: randomUUID(),
        businessId: biz.id,
        branchId: body?.branchId ? String(body.branchId) : null,
        ...patch,
      })
      .returning();
    return NextResponse.json({ success: true, offer: created });
  } catch (error: unknown) {
    console.error('[BUSINESS_OFFERS_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'No pudimos guardar la oferta.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'Inicia sesión.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? '').trim();
    const status = String(body?.status ?? '').toUpperCase();
    if (!id || !['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Datos inválidos.' }, { status: 400 });
    }

    const biz = await resolveBusiness(caller.id, caller.role, body?.businessId ?? null);
    if (!biz) return NextResponse.json({ success: false, error: 'No encontramos tu negocio.' }, { status: 404 });

    const [updated] = await db
      .update(businessOffers)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(businessOffers.id, id), eq(businessOffers.businessId, biz.id)))
      .returning();
    if (!updated) return NextResponse.json({ success: false, error: 'Oferta no encontrada.' }, { status: 404 });

    return NextResponse.json({ success: true, offer: updated });
  } catch (error: unknown) {
    console.error('[BUSINESS_OFFERS_PATCH]', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'No pudimos actualizar la oferta.' }, { status: 500 });
  }
}
