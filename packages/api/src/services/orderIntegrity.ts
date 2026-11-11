/**
 * ── Integridad de órdenes (Fase 0B-1) ──────────────────────────────────────
 *
 * Punto ÚNICO autorizado para mutar `orders` / `order_items`.
 * Ver: Docs/POS-FASE-0/ADR-018-integridad-ordenes.md
 *
 * ⚠️ Estado: helper introducido SIN cablear. Ningún procedimiento lo usa aún.
 *    Por diseño, esta entrega no cambia comportamiento: solo agrega el
 *    mecanismo y la bitácora. El cableado ocurre en los pasos 2–5 del ADR-018.
 *
 * Reglas que implementa:
 *  · Bloqueo pesimista de la orden (`SELECT … FOR UPDATE`).
 *  · Versión optimista obligatoria (si el llamador la envía).
 *  · Incremento de `version` y bitácora append-only en `order_events`.
 *  · Conflicto explícito (`OrderConflictError`) en vez de sobrescritura silenciosa.
 */

import { and, eq, sql } from "drizzle-orm";
import { orders, orderEvents, orderItems, payments } from "@rabbitty/database-restaurant/schema";

/** Tasa de IVA vigente en el POS. Debe coincidir con `pos.ts`. */
const TAX_RATE = 0.16;
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Misma garantía que `calcTax` del POS: `subtotal + tax === total`,
 * sin redondear el IVA por separado.
 *
 * Se centraliza aquí para que, al cablear el helper, `pos.ts` importe esta
 * función y desaparezca la copia local (evita divergencia de dinero).
 */
export function calcTax(itemsTotal: number): { total: number; subtotal: number; tax: number } {
  const total = r2(itemsTotal);
  const subtotal = r2(total / (1 + TAX_RATE));
  const tax = r2(total - subtotal);
  return { total, subtotal, tax };
}

export type OrderActor = {
  staffId?: string | null;
  terminalId?: string | null;
};

export interface MutationOptions {
  orderId: string;
  /** Si se envía, la mutación falla con `OrderConflictError` al no coincidir. */
  expectedVersion?: number;
  actor?: OrderActor;
  /** Tipo de evento registrado en `order_events` (ej. ITEM_ADDED, VOIDED, PAID). */
  type: string;
  /** Si se envía, el asiento es idempotente (índice único parcial). */
  idempotencyKey?: string;
  /** Estados permitidos para mutar. Por defecto: cualquiera salvo los terminales. */
  allowedStatuses?: string[];
}

export class OrderConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(
    readonly orderId: string,
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `La orden ${orderId} cambió (esperaba v${expectedVersion}, está en v${currentVersion}). Recarga y vuelve a intentar.`,
    );
    this.name = "OrderConflictError";
  }
}

/**
 * Se lanza cuando se intenta borrar/rollbackear una orden que ya tiene dinero
 * aplicado. Nunca se debe borrar una orden cobrada: dejaría el pago huérfano.
 */
export class OrderRollbackBlockedError extends Error {
  readonly code = "CONFLICT";
  constructor(readonly orderId: string, readonly reason: string) {
    super(`No se puede revertir la orden ${orderId}: ${reason}`);
    this.name = "OrderRollbackBlockedError";
  }
}

export class OrderNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(orderId: string) {
    super(`Orden no encontrada: ${orderId}`);
    this.name = "OrderNotFoundError";
  }
}

export interface MutationContext {
  actor: OrderActor;
  /** Recalcula totales de la orden desde sus ítems (misma fórmula del POS). */
  recalcTotals: () => Promise<void>;
}

export interface MutationResult<T> {
  result: T;
  order: any;
  version: number;
}

/**
 * Ejecuta una mutación sobre una orden dentro de una transacción existente.
 *
 * El llamador DEBE pasar un `tx` (no la conexión suelta): el bloqueo solo
 * tiene sentido dentro de la transacción.
 */
export async function withOrderMutation<T>(
  tx: any,
  opts: MutationOptions,
  fn: (order: any, ctx: MutationContext) => Promise<T>,
): Promise<MutationResult<T>> {
  const [current] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, opts.orderId))
    .for("update");

  if (!current) throw new OrderNotFoundError(opts.orderId);

  if (typeof opts.expectedVersion === "number" && Number(current.version) !== opts.expectedVersion) {
    throw new OrderConflictError(opts.orderId, opts.expectedVersion, Number(current.version));
  }

  if (opts.allowedStatuses && !opts.allowedStatuses.includes(String(current.status))) {
    throw new Error(`ORDER_STATUS_NOT_ALLOWED: ${current.status}`);
  }

  const ctx: MutationContext = {
    actor: opts.actor ?? {},
    recalcTotals: async () => {
      await recalcOrderTotals(tx, opts.orderId);
    },
  };

  const result = await fn(current, ctx);

  const [updated] = await tx
    .update(orders)
    .set({
      version: sql`${orders.version} + 1`,
      updatedByStaffId: opts.actor?.staffId ?? null,
      updatedByTerminalId: opts.actor?.terminalId ?? null,
    })
    .where(eq(orders.id, opts.orderId))
    .returning();
  if (!updated) throw new OrderNotFoundError(opts.orderId);

  await recordOrderEvent(tx, {
    orderId: opts.orderId,
    type: opts.type,
    versionBefore: Number(current.version),
    versionAfter: Number(updated.version),
    actor: opts.actor,
    idempotencyKey: opts.idempotencyKey,
    payload: null,
  });

  return { result, order: updated, version: Number(updated.version) };
}

/** Recalcula subtotal/IVA/total desde los ítems vivos de la orden. */
export async function recalcOrderTotals(tx: any, orderId: string): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const { total, subtotal, tax } = calcTax(
    items.reduce((sum: number, i: any) => sum + Number(i.totalPrice), 0),
  );
  await tx.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, orderId));
}

/**
 * Asiento append-only. Si `idempotencyKey` ya existe, no duplica
 * (índice único parcial `order_events_idempotency_uidx`).
 */
export async function recordOrderEvent(
  tx: any,
  input: {
    orderId: string;
    type: string;
    versionBefore: number;
    versionAfter: number;
    actor?: OrderActor;
    idempotencyKey?: string;
    payload?: Record<string, unknown> | null;
  },
): Promise<void> {
  await tx
    .insert(orderEvents)
    .values({
      orderId: input.orderId,
      type: input.type,
      versionBefore: input.versionBefore,
      versionAfter: input.versionAfter,
      staffId: input.actor?.staffId ?? null,
      terminalId: input.actor?.terminalId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      payload: input.payload ?? null,
    })
    // `DO NOTHING` sin target: el índice único de idempotencia es PARCIAL
    // (`WHERE "idempotencyKey" IS NOT NULL`) y Postgres no lo infiere con
    // `ON CONFLICT ("idempotencyKey")` — exige el predicado.
    .onConflictDoNothing();
}

/**
 * Alta de orden. Sin versión (nace en 1), con idempotencia opcional por
 * `orders.idempotencyKey`, que ya es único en base.
 */
export async function withOrderCreate<T>(
  tx: any,
  opts: { actor?: OrderActor; idempotencyKey?: string },
  fn: (ctx: { actor: OrderActor }) => Promise<T>,
): Promise<T> {
  return fn({ actor: opts.actor ?? {} });
}

/**
 * Verifica el invariante `total = subtotal + tax` con tolerancia de un centavo.
 * Se usará en la conciliación nocturna (ADR-018 §8), no en el camino caliente.
 */
export function assertTotalsInvariant(order: {
  subtotal: number;
  tax: number;
  total: number;
}): { ok: boolean; drift: number } {
  const expected = r2(Number(order.subtotal) + Number(order.tax));
  const drift = r2(Number(order.total) - expected);
  return { ok: Math.abs(drift) <= 0.01, drift };
}


/**
 * ── Rollback seguro de una orden recién creada ─────────────────────────────
 *
 * Pensado para el camino de error de `directCheckout`: si el cobro falla y la
 * orden era nueva, se borra para no dejar borradores huérfanos.
 *
 * **Guarda obligatoria:** rechaza el borrado si la orden ya tiene algún pago
 * `COMPLETED` o si su estado es terminal (`PAID`, `COMPLETED`). Sin esto, un
 * fallo posterior al cobro borraría una orden pagada y el dinero quedaría sin
 * respaldo. Ver Docs/POS-FASE-0/ADR-022 (riesgo R-A).
 */
export async function withOrderRollback<T>(
  tx: any,
  opts: { orderId: string; reason?: string },
  fn: (order: any) => Promise<T>,
): Promise<T> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, opts.orderId))
    .for("update");

  if (!order) throw new OrderNotFoundError(opts.orderId);

  const [applied] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.orderId, opts.orderId), eq(payments.status, "COMPLETED")))
    .limit(1);
  if (applied) throw new OrderRollbackBlockedError(opts.orderId, "PAYMENT_ALREADY_APPLIED");

  const terminal = new Set(["PAID", "COMPLETED", "REFUNDED"]);
  if (terminal.has(String(order.status))) {
    throw new OrderRollbackBlockedError(opts.orderId, `STATUS_${order.status}`);
  }

  return fn(order);
}
