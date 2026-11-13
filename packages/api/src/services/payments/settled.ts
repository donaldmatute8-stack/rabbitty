/**
 * ── Estados de pago que cuentan para dinero ────────────────────────────────
 *
 * Un reembolso no borra el cobro: deja la fila original marcada
 * (`PARTIALLY_REFUNDED` / `REFUNDED`) y añade una fila negativa con el reverso.
 * Sumar solo `COMPLETED` hacía que una venta reembolsada en parte desapareciera
 * del turno y de los reportes (se contaba 0 en vez del neto).
 *
 * Regla: para **sumar dinero** se usan los tres estados y el importe con signo.
 * Para decidir "¿está pagada?" NO se usa esto (ver `isOrderPaidStatus`).
 */

import { inArray } from "drizzle-orm";
import { payments } from "@rabbitty/database-restaurant/schema";

export const SETTLED_PAYMENT_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

/** Filtro para agregados de dinero: incluye las filas de reverso. */
export function settledPaymentStatuses() {
  return inArray(payments.status, [...SETTLED_PAYMENT_STATUSES]);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
