/**
 * ── Mapper: paymentCore → contratos canónicos (RP-0.1) ─────────────────────
 *
 * Solo lectura/mapeo. **No escribe** ni ejecuta cobros: sirve para comparar el
 * resultado del motor nuevo contra el legacy en RP-0.2 (shadow mode).
 */

import {
  buildAmounts,
  normalizeBunz,
  toCanonicalIntentStatus,
  type CanonicalPaymentIntent,
  type PaymentCurrency,
  type PaymentIds,
  type PaymentMethod,
} from "../contracts";

export interface CoreIntentResultLike {
  intentId: string;
  orderId?: string;
  grossAmountCents: number;
  bunzDiscountCents?: number;
  bunzApplied?: number;
  netFiatCents: number;
  platformFeeCents?: number;
  currency?: string;
  status: string;
  idempotencyKey: string;
  expiresAt: Date | string;
  createdAt?: Date | string;
}

export interface CoreIntentRowLike {
  id: string;
  orderId?: string | null;
  merchantId: string;
  payerSubjectId?: string | null;
  amountCents: number;
  netFiatCents: number;
  bunzAmount: number;
  platformFeeCents?: number;
  currency?: string | null;
  status: string;
  idempotencyKey?: string | null;
  expiresAt: Date | string;
  paidAt?: Date | null;
  createdAt: Date | string;
}

function pickMethod(bunz: number, fiatMinor: number): PaymentMethod {
  if (bunz > 0 && fiatMinor > 0) return "MIXED";
  if (bunz > 0) return "BUNZ";
  if (fiatMinor > 0) return "CARD";
  return "UNKNOWN";
}

export function toCanonicalIntentFromCoreResult(
  result: CoreIntentResultLike,
  ids: PaymentIds
): CanonicalPaymentIntent {
  const currency = String(result.currency || "MXN").toUpperCase() as PaymentCurrency;
  const totalMinor = Math.round(Number(result.grossAmountCents || 0));
  const fiatMinor = Math.round(Number(result.netFiatCents || 0));
  const bunz = normalizeBunz(
    result.bunzApplied ?? Math.round(Number(result.bunzDiscountCents || 0) / 100)
  );

  const amounts = buildAmounts({
    totalMinor,
    bunz,
    platformFeeMinor: Math.round(Number(result.platformFeeCents || 0)),
    currency,
  });

  return {
    id: result.intentId,
    ids: { ...ids, orderId: result.orderId ?? ids.orderId, intentId: result.intentId },
    status: toCanonicalIntentStatus(result.status),
    method: pickMethod(bunz, fiatMinor),
    amounts: {
      ...amounts,
      fiat: { amountMinor: fiatMinor, currency },
    },
    reference: { provider: "STRIPE" },
    idempotencyKey: result.idempotencyKey,
    expiresAt: new Date(result.expiresAt),
    createdAt: new Date(result.createdAt ?? Date.now()),
  };
}

export function toCanonicalIntentFromRow(
  row: CoreIntentRowLike,
  ids?: Partial<PaymentIds>
): CanonicalPaymentIntent {
  const currency = String(row.currency || "MXN").toUpperCase() as PaymentCurrency;
  const totalMinor = Math.round(Number(row.amountCents || 0));
  const fiatMinor = Math.round(Number(row.netFiatCents || 0));
  const bunz = normalizeBunz(Number(row.bunzAmount || 0));

  const amounts = buildAmounts({
    totalMinor,
    bunz,
    platformFeeMinor: Math.round(Number(row.platformFeeCents || 0)),
    currency,
  });

  return {
    id: row.id,
    ids: {
      branchId: ids?.branchId ?? row.merchantId,
      orderId: row.orderId ?? undefined,
      customerId: row.payerSubjectId ?? undefined,
      intentId: row.id,
      ...ids,
    },
    status: toCanonicalIntentStatus(row.status),
    method: pickMethod(bunz, fiatMinor),
    amounts: {
      ...amounts,
      fiat: { amountMinor: fiatMinor, currency },
    },
    reference: { provider: "STRIPE" },
    idempotencyKey: row.idempotencyKey ?? "",
    expiresAt: new Date(row.expiresAt),
    paidAt: row.paidAt ? new Date(row.paidAt) : undefined,
    createdAt: new Date(row.createdAt),
  };
}
