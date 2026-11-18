import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { branches, restaurants, menuItems } from '@rabbitty/database-restaurant/schema';
import { eq, inArray } from 'drizzle-orm';
import { quoteDelivery } from '@rabbitty/api/services/deliveryQuote';

export const runtime = 'nodejs';

/**
 * ── POST /api/delivery/quote ── cotización de envío para la app ────────────
 *
 * Sirve para MOSTRAR el costo antes de confirmar. El cobro real lo hace
 * `/api/pos/checkout` recalculando con la misma función: nunca se confía en el
 * monto que manda el cliente.
 *
 * El subtotal se calcula aquí desde la base (no se acepta del cliente) porque de
 * él depende el envío gratis (`freeOver`). Sin artículos, se acepta `subtotal`
 * sólo como referencia de carrito vacío.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      branchOrBusinessId?: string;
      items?: Array<{ id: string; quantity: number }>;
      addressData?: Record<string, unknown> | null;
    };

    const ref = body.branchOrBusinessId;
    if (!ref) {
      return NextResponse.json({ success: false, error: 'Falta la sucursal o el negocio' }, { status: 400 });
    }

    // Sucursal: acepta id de sucursal o de negocio (el perfil afiliado manda el
    // del negocio, igual que el checkout).
    //
    // OJO: un restaurante puede tener varias sucursales, incluida la archivada y
    // la de Sandbox. Antes se tomaba `limit(1)` a secas y podía caer en la
    // archivada (sin coordenadas), así que la cotización por zona nunca aplicaba.
    // Se elige igual que el checkout: activa, de producción, no sandbox.
    const branchCols = {
      id: branches.id,
      restaurantId: branches.restaurantId,
      address: branches.address,
      lat: branches.lat,
      lng: branches.lng,
      isActive: branches.isActive,
      name: branches.name,
    } as const;

    const [byId] = await restaurantDb
      .select(branchCols)
      .from(branches)
      .where(eq(branches.id, ref))
      .limit(1);

    let branch = byId ?? null;
    if (!branch) {
      const candidates = await restaurantDb
        .select(branchCols)
        .from(branches)
        .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
        .where(eq(restaurants.businessId, ref));

      const active = candidates.filter((b) => b.isActive !== false);
      const production =
        active.find((b) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ??
        active[0] ??
        candidates[0];
      branch = production ?? null;
    }

    if (!branch) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 });
    }

    const [restaurant] = await restaurantDb
      .select({ deliveryConfig: restaurants.deliveryConfig, currency: restaurants.currency })
      .from(restaurants)
      .where(eq(restaurants.id, branch.restaurantId))
      .limit(1);

    const lines = (body.items ?? []).filter((i) => i?.id && i.quantity > 0);
    const ids = [...new Set(lines.map((l) => l.id))];
    const priceRows = ids.length
      ? await restaurantDb
          .select({ id: menuItems.id, price: menuItems.price })
          .from(menuItems)
          .where(inArray(menuItems.id, ids))
      : [];
    const priceById = new Map(priceRows.map((row) => [row.id, Number(row.price)]));
    const subtotal = lines.reduce(
      (sum, line) => sum + (priceById.get(line.id) ?? 0) * line.quantity,
      0,
    );

    const addressData = body.addressData ?? {};
    const dropoff = {
      street1: typeof addressData.street1 === 'string' ? addressData.street1 : null,
      neighborhood: typeof addressData.neighborhood === 'string' ? addressData.neighborhood : null,
      city: typeof addressData.city === 'string' ? addressData.city : null,
      state: typeof addressData.state === 'string' ? addressData.state : null,
      zip: typeof addressData.zip === 'string' ? addressData.zip : null,
      country: typeof addressData.country === 'string' ? addressData.country : 'MX',
      phone: typeof addressData.phone === 'string' ? addressData.phone : null,
      lat: typeof addressData.lat === 'number' ? addressData.lat : null,
      lng: typeof addressData.lng === 'number' ? addressData.lng : null,
    };

    const quote = await quoteDelivery({
      config: restaurant?.deliveryConfig ?? null,
      subtotal,
      dropoff,
      // Las coordenadas de la sucursal son lo que permite cotizar por zona
      // (por distancia). Sin ellas se usa la tarifa fija.
      pickup: {
        street1: branch.address ?? null,
        city: null,
        country: 'MX',
        lat: branch.lat ?? null,
        lng: branch.lng ?? null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        subtotal,
        quote: {
          fee: quote.fee,
          currency: quote.currency,
          source: quote.source,
          provider: quote.provider ?? null,
          etaMinutes: quote.etaMinutes,
          label: quote.label,
          expiresAt: quote.expiresAt ?? null,
        },
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('[DELIVERY_QUOTE]', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'No pudimos cotizar el envío' }, { status: 500 });
  }
}
