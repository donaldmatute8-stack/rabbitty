import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { db } from '@/db';
import { branches, restaurants, merchantPaymentAccounts } from '@rabbitty/database-restaurant/schema';
import { ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * ── GET /api/pay/capabilities?businessId=… ── qué puede pagar el cliente ────
 *
 * La UI no debe asumir rieles: pregunta capacidades y muestra u oculta cada
 * opción con su motivo. Los tres caminos del pedido desde la app:
 *
 * - **Caja (efectivo):** el pedido nace PENDING_PAYMENT y el POS lo muestra en
 *   "Por cobrar" (badge ámbar). La cocina no lo prepara hasta que se cobre.
 * - **Bunz:** se debita en el checkout y nace PAID; sólo si el negocio acepta
 *   Bunz (`ownedBusinesses.acceptsBunz`).
 * - **Rabbitty Pay (tarjeta):** el pedido se crea y se paga con Stripe
 *   (Payment Element). Requiere que la sucursal de PRODUCCIÓN tenga una cuenta
 *   Connect con `chargesEnabled`; si no, se oculta con el motivo.
 *
 * Por qué importa el negocio: antes se respondía "tarjeta disponible" leyendo
 * sólo el registro global de rieles. Un negocio con onboarding incompleto veía
 * la opción, la elegía y el cobro fallaba con STRIPE_CONNECT_NOT_READY.
 *
 * No cobra nada: sólo lee estado.
 */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId')?.trim() || null;

  let cardAvailable = false;
  let cardReason: string | null = 'Elige un negocio para ver si acepta tarjeta.';
  let bunzAvailable = true;
  let bunzReason: string | null = null;

  if (businessId) {
    // Misma regla que checkout: sucursal activa de PRODUCCIÓN (no Sandbox).
    const rows = await restaurantDb
      .select({ id: branches.id, name: branches.name, isActive: branches.isActive })
      .from(branches)
      .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
      .where(eq(restaurants.businessId, businessId));

    const active = rows.filter((b) => b.isActive !== false);
    const production =
      active.find((b) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ?? active[0] ?? null;

    if (!production) {
      cardAvailable = false;
      cardReason = 'Este negocio aún no tiene sucursal activa para cobrar con tarjeta.';
    } else {
      const [account] = await restaurantDb
        .select({
          chargesEnabled: merchantPaymentAccounts.chargesEnabled,
          provider: merchantPaymentAccounts.provider,
        })
        .from(merchantPaymentAccounts)
        .where(eq(merchantPaymentAccounts.branchId, production.id))
        .limit(1);

      cardAvailable = Boolean(account?.chargesEnabled);
      cardReason = cardAvailable
        ? null
        : 'El negocio todavía no termina su alta de cobros con tarjeta.';
    }

    const [biz] = await db
      .select({ acceptsBunz: ownedBusinesses.acceptsBunz })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, businessId))
      .limit(1);

    // Sin registro (p. ej. sucursal suelta) se conserva el comportamiento
    // anterior: Bunz disponible. Con registro manda el flag del negocio.
    bunzAvailable = biz ? biz.acceptsBunz !== false : true;
    bunzReason = bunzAvailable ? null : 'Este negocio aún no acepta Bunz.';
  }

  return NextResponse.json(
    {
      success: true,
      businessId,
      methods: {
        cash: {
          id: 'CASH',
          label: 'Pagar en caja',
          hint: 'Te esperamos en caja. La cocina arranca al cobrar.',
          available: true,
        },
        bunz: {
          id: 'BUNZ',
          label: 'Pagar con Bunz',
          hint: bunzAvailable
            ? 'Se descuenta de tu saldo al confirmar.'
            : 'Este negocio aún no acepta Bunz.',
          available: bunzAvailable,
          reason: bunzReason,
        },
        card: {
          id: 'CARD',
          label: 'Rabbitty Pay · tarjeta',
          hint: cardAvailable
            ? 'Pago seguro con tarjeta desde la app.'
            : 'No disponible por ahora.',
          available: cardAvailable,
          reason: cardReason,
        },
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
