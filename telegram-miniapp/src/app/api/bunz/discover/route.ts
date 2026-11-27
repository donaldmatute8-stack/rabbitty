import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { ownedBusinesses, users } from '@/db/schema';
import { restaurantDb } from '@/db/restaurant';
import { branches, restaurants, cashShifts } from '@rabbitty/database-restaurant/schema';
import { isBusinessOpen } from '@/lib/chat';
import { resolveBusinessCover } from '@/lib/businessCover';
import { syntheticOfferFor } from '@/lib/syntheticOffers';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * ── Descubrimiento Bunz (una sola lista) ───────────────────────────────────
 *
 * Devuelve los negocios con lo que aplica para ESTE Rabbitter:
 *   · earn  → cuánto devuelve (si da Bunz)
 *   · spend → desde cuántos Bunz y cuántos canjes alcanzan
 *   · open  → horario + caja
 *   · score → orden listo para pintar (canjeable primero, luego abierto, luego
 *             recompensa, luego cercanía)
 *
 * El cliente no decide "modo": pinta lo que llega. Si un negocio no tiene ni
 * earn ni spend, no viaja en la respuesta.
 *
 * Cuando exista `business_offers`, solo cambia la fuente de `spend` (una línea).
 */

const DEG = Math.PI / 180;

function distanceKm(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6371;
  const dLat = (bLat - aLat) * DEG;
  const dLng = (bLng - aLng) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 10) / 10;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get('lat') || 'NaN');
    const lng = Number(url.searchParams.get('lng') || 'NaN');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const caller = await getAuthenticatedUser(req).catch(() => null);
    let balance = 0;
    if (caller?.id) {
      const [u] = await db
        .select({ earned: users.totalBunzEarned, spent: users.totalBunzSpent })
        .from(users)
        .where(eq(users.id, caller.id))
        .limit(1);
      balance = Math.max(0, Number(u?.earned ?? 0) - Number(u?.spent ?? 0));
    }

    // Mismo catálogo público: aprobado y no sandbox.
    const businesses = await db
      .select()
      .from(ownedBusinesses)
      .where(and(eq(ownedBusinesses.status, 'APPROVED'), eq(ownedBusinesses.sandbox, false)))
      .limit(100);

    if (businesses.length === 0) {
      return NextResponse.json({ success: true, balance, businesses: [] });
    }

    const ids = businesses.map((b) => b.id);

    // Sucursal de producción por negocio (misma regla del checkout).
    const branchRows = await restaurantDb
      .select({
        branchId: branches.id,
        businessId: restaurants.businessId,
        name: branches.name,
        isActive: branches.isActive,
      })
      .from(branches)
      .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
      .where(inArray(restaurants.businessId, ids));

    const branchByBusiness = new Map<string, { id: string; name: string }>();
    const grouped = new Map<string, Array<{ id: string; name: string; isActive: boolean }>>();
    for (const row of branchRows) {
      const list = grouped.get(row.businessId) ?? [];
      list.push({ id: row.branchId, name: row.name, isActive: row.isActive !== false });
      grouped.set(row.businessId, list);
    }
    for (const [businessId, list] of grouped) {
      const active = list.filter((b) => b.isActive);
      const production =
        active.find((b) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ??
        active[0] ??
        list[0];
      if (production) branchByBusiness.set(businessId, { id: production.id, name: production.name });
    }

    // Turnos de caja abiertos (una sola consulta).
    const branchIds = [...branchByBusiness.values()].map((b) => b.id);
    const openShiftRows = branchIds.length
      ? await restaurantDb
          .select({ branchId: cashShifts.branchId })
          .from(cashShifts)
          .where(and(inArray(cashShifts.branchId, branchIds), eq(cashShifts.status, 'OPEN')))
      : [];
    const openShiftBranches = new Set(openShiftRows.map((r) => r.branchId));

    const items = businesses
      .filter((b) => {
        if (!q) return true;
        return (
          b.name?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q) ||
          b.niche?.toLowerCase().includes(q)
        );
      })
      .map((b) => {
        const branch = branchByBusiness.get(b.id) ?? null;
        const scheduleOpen = isBusinessOpen(b);
        const shiftOpen = branch ? openShiftBranches.has(branch.id) : false;
        const open = scheduleOpen || shiftOpen;

        const offer = syntheticOfferFor(b);
        const spend = offer
          ? {
              title: offer.title,
              minCost: offer.bunzCost,
              canjesDisponibles: offer.canjesDisponibles,
              affordable: balance >= offer.bunzCost,
              faltan: balance >= offer.bunzCost ? 0 : offer.bunzCost - balance,
            }
          : null;

        const earn = b.givesBunz && Number(b.rewardPercentage || 0) > 0
          ? { pct: Number(b.rewardPercentage) }
          : null;

        // Sin nada que ofrecer, no se lista.
        if (!earn && !spend) return null;

        const dist = distanceKm(
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null,
          b.lat,
          b.lng,
        );

        const canjear = Boolean(spend?.affordable && spend.canjesDisponibles > 0);
        const proximity = dist == null ? 10 : Math.max(0, 30 - Math.min(30, dist * 3));
        const score =
          (canjear ? 100 : 0) +
          (open ? 40 : 0) +
          (spend ? 20 : 0) +
          (earn ? 10 + Math.min(10, earn.pct / 2) : 0) +
          proximity;

        const tags: string[] = [];
        if (canjear) tags.push('Puedes canjear');
        if (spend && spend.canjesDisponibles <= 4) tags.push(`Últimas ${spend.canjesDisponibles}`);
        if (earn) tags.push(`+${earn.pct}%`);
        if (!open) tags.push('Cerrado');

        return {
          id: b.id,
          name: b.name,
          category: b.category,
          niche: b.niche,
          imageUrl: resolveBusinessCover({ id: b.id, gallery: b.gallery, category: b.category }),
          logoUrl: b.logoUrl,
          lat: b.lat,
          lng: b.lng,
          distanceKm: dist,
          open,
          scheduleOpen,
          shiftOpen,
          opensAt: `${b.startTime}–${b.endTime}`,
          earn,
          spend,
          tags,
          score,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ success: true, balance, businesses: items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[BUNZ_DISCOVER]', message);
    return NextResponse.json({ success: false, error: 'No pudimos cargar Bunz ahora.' }, { status: 500 });
  }
}
