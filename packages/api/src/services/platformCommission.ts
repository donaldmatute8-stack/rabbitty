/**
 * ── Comisión de plataforma (marketplace) ──────────────────────────────────
 *
 * **No** es el excedente por uso del riel. Ese es `platformFeeCents` en
 * `payment_intents` (1 % por cobrar con un método de pago) y cubre el costo de
 * Stripe/terminal. Esta comisión es el ingreso de Rabbitty por traer al cliente,
 * el equivalente al take rate de un marketplace.
 *
 * Reglas (decididas con el negocio):
 * - **Bunz nunca paga comisión.** La base es el total menos lo pagado con Bunz.
 * - **Sólo dinero** (efectivo, tarjeta, transferencia). Un pedido 100 % Bunz no
 *   genera comisión.
 * - **Apagada por defecto.** Nada se cobra hasta que el negocio la acepte y se
 *   active en su configuración; el código queda listo y auditable.
 * - **Se congela en la orden** (`commissionPct`) para que cambiar la tarifa no
 *   reescriba el historial ni la liquidación de meses anteriores.
 *
 * `appliesTo` acota el alcance:
 * - `APP_ORDERS` (recomendado): sólo pedidos que llegaron por la app. La venta de
 *   mostrador en efectivo no paga comisión — el comercio no gana nada ahí por
 *   nosotros y cobrarla sería el error que hunde la adopción.
 * - `ALL`: todo pedido con parte en dinero.
 */

import { eq } from "drizzle-orm";
import { orders, branches, restaurants } from "@rabbitty/database-restaurant/schema";

export type CommissionAppliesTo = "APP_ORDERS" | "ALL";

export interface PlatformCommissionConfig {
  enabled?: boolean;
  /** 0.02 = 2 %. */
  pct?: number;
  appliesTo?: CommissionAppliesTo;
  /** Piso en MXN: si la comisión calculada es menor, se cobra este mínimo. */
  minFeeMxn?: number;
  notes?: string;
}

export interface CommissionInput {
  /** Total del pedido en centavos (con propina y envío). */
  grossCents: number;
  /** Parte pagada con Bunz, en centavos. */
  bunzCents?: number;
  /** ¿El pedido llegó por la app (no de mostrador)? */
  fromApp: boolean;
  config?: PlatformCommissionConfig | null;
}

export interface CommissionResult {
  /** Base comisionable (gross - bunz), en centavos. Nunca negativa. */
  baseCents: number;
  /** Tarifa aplicada (congelada en la orden). */
  pct: number;
  /** Comisión final en centavos. */
  cents: number;
  /** Motivo legible cuando no se cobra. */
  reason?: "disabled" | "bunz_only" | "not_app_order" | "no_base";
}

const toCents = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

export function computePlatformCommission({
  grossCents,
  bunzCents = 0,
  fromApp,
  config,
}: CommissionInput): CommissionResult {
  const baseCents = Math.max(0, toCents(grossCents) - toCents(bunzCents));

  if (!config || config.enabled !== true) {
    return { baseCents, pct: 0, cents: 0, reason: "disabled" };
  }
  const appliesTo = config.appliesTo ?? "APP_ORDERS";
  if (appliesTo === "APP_ORDERS" && !fromApp) {
    return { baseCents, pct: 0, cents: 0, reason: "not_app_order" };
  }
  if (baseCents <= 0) {
    return { baseCents, pct: 0, cents: 0, reason: "bunz_only" };
  }

  const pct = typeof config.pct === "number" && config.pct > 0 ? config.pct : 0;
  if (pct <= 0) {
    return { baseCents, pct: 0, cents: 0, reason: "disabled" };
  }

  const raw = Math.round(baseCents * pct);
  const minCents = toCents((config.minFeeMxn ?? 0) * 100);
  // El mínimo nunca puede superar la base: cobrar más comisión que el monto de la
  // venta es un error de negocio (y de contrato).
  const cents = Math.min(Math.max(raw, minCents), baseCents);

  return { baseCents, pct, cents };
}

/**
 * Calcula la comisión de una orden ya existente y devuelve el "patch" listo para
 * escribir en `orders`. Vive aquí para que **los dos** cierres del POS (cobro
 * normal y cobro dividido) usen exactamente la misma regla.
 *
 * `fromApp` se deduce del `customerId`: un pedido que nació en la app y se cobró en
 * caja sí genera comisión; la venta de mostrador a un cliente nuevo, no.
 */
export async function buildOrderCommissionPatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  orderId: string,
): Promise<{ commissionBaseCents: number; commissionPct: number; commissionCents: number }> {
  const [row] = await tx
    .select({
      platformCommission: restaurants.platformCommission,
      total: orders.total,
      bunzPaid: orders.bunzPaid,
      customerId: orders.customerId,
    })
    .from(orders)
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) {
    return { commissionBaseCents: 0, commissionPct: 0, commissionCents: 0 };
  }

  const result = computePlatformCommission({
    grossCents: Math.round(Number(row.total ?? 0) * 100),
    bunzCents: Math.round(Number(row.bunzPaid ?? 0) * 100),
    fromApp: Boolean(row.customerId),
    config: row.platformCommission as PlatformCommissionConfig | null,
  });

  return {
    commissionBaseCents: result.baseCents,
    commissionPct: result.pct,
    commissionCents: result.cents,
  };
}

/** Formato corto para tickets y notas ("2 % · $11.20"). */
export function describeCommission(result: CommissionResult): string {
  if (result.cents <= 0) {
    if (result.reason === "bunz_only") return "Sin comisión (100 % Bunz)";
    if (result.reason === "not_app_order") return "Sin comisión (venta de mostrador)";
    return "Sin comisión";
  }
  const pct = (result.pct * 100).toLocaleString("es-MX", { maximumFractionDigits: 2 });
  return `${pct} % · $${(result.cents / 100).toFixed(2)}`;
}
