/**
 * ── Rabbitty Pay · Shadow mode (RP-0.2) ────────────────────────────────────
 *
 * Instrumentación **read-only**: compara lo que hace el motor legacy con lo que
 * diría el predicado canónico. No escribe dinero, no cambia estados, no altera
 * el resultado financiero.
 */

import {
  computeOrderPaymentState,
  toCanonicalIntentStatus,
  toCanonicalMethod,
  toMinorUnits,
  type OrderPaymentState,
  type PaymentReference,
  type SettlementLine,
} from "./contracts";

export interface ShadowPaymentRow {
  id: string;
  orderId?: string | null;
  amount: number;
  method: string;
  status: string;
  reference?: string | null;
  tipAmount?: number | null;
  verificationMethod?: string | null;
}

export interface ShadowOrderRow {
  id: string;
  branchId?: string | null;
  total: number;
  status: string;
  bunzPaid?: number | null;
}

export interface ShadowIntentRow {
  id: string;
  orderId?: string | null;
  merchantId: string;
  status: string;
  amountCents: number;
  netFiatCents: number;
  bunzAmount: number;
  currency?: string | null;
  externalIntentId?: string | null;
}

export interface ShadowDifference {
  field: string;
  legacy: unknown;
  canonical: unknown;
}

export interface ShadowReport {
  orderId: string;
  intentId?: string;
  currency: string;
  totalMinor: number;
  legacy: {
    state: OrderPaymentState;
    totalPaidMinor: number;
    orderStatus: string;
  };
  canonical: ReturnType<typeof computeOrderPaymentState>;
  differences: ShadowDifference[];
  matches: boolean;
  createdAt: string;
}

const MAX_RECENT = 100;
const recentShadowDiffs: ShadowReport[] = [];

function normalizeLineStatus(status: string): SettlementLine["status"] {
  switch (String(status).toUpperCase()) {
    case "COMPLETED":
      return "COMPLETED";
    case "REFUNDED":
      return "REFUNDED";
    case "PARTIALLY_REFUNDED":
      return "PARTIALLY_REFUNDED";
    case "PENDING":
    case "PENDING_PAYMENT":
      return "PENDING";
    default:
      return "FAILED";
  }
}

export function mapPaymentRowToSettlementLine(row: ShadowPaymentRow): SettlementLine {
  const amountMinor = toMinorUnits(Number(row.amount || 0));
  const method = toCanonicalMethod(String(row.method || ""));
  const referenceRaw = String(row.reference ?? "");

  let reference: PaymentReference | undefined;
  if (referenceRaw.startsWith("ch_")) {
    reference = { provider: "STRIPE", chargeId: referenceRaw, externalId: referenceRaw };
  } else if (referenceRaw.startsWith("pi_")) {
    reference = { provider: "STRIPE", externalId: referenceRaw };
  } else if (referenceRaw.startsWith("RESERVE:")) {
    reference = { provider: "INTERNAL", externalId: referenceRaw };
  } else if (
    referenceRaw.trim().length >= 3 &&
    (method === "CARD" || method === "EXTERNAL_TERMINAL")
  ) {
    reference = { provider: "EXTERNAL_TERMINAL", terminalReference: referenceRaw.trim() };
  } else if (method === "BUNZ") {
    reference = { provider: "INTERNAL" };
  }

  return {
    amountMinor,
    method,
    status: normalizeLineStatus(row.status),
    reference,
  };
}

/** Predicado legacy (el que usan hoy paymentCore/pos/checkout). */
export function evaluateLegacyOrder(
  order: ShadowOrderRow,
  payments: ShadowPaymentRow[]
): { state: OrderPaymentState; totalPaidMinor: number } {
  const totalMinor = toMinorUnits(Number(order.total || 0));
  const totalPaidMinor = payments
    .filter((p) => String(p.status).toUpperCase() === "COMPLETED")
    .reduce((sum, p) => sum + Math.max(0, toMinorUnits(Number(p.amount || 0))), 0);

  const status = String(order.status || "").toUpperCase();
  if (["VOID", "CANCELLED", "EXPIRED", "REFUNDED"].includes(status)) {
    return { state: "VOID", totalPaidMinor };
  }
  if (status === "COMPLETED" || status === "PAID") {
    return { state: "PAID", totalPaidMinor };
  }
  if (totalPaidMinor >= totalMinor && totalMinor >= 0) {
    return { state: "PAID", totalPaidMinor };
  }
  if (totalPaidMinor > 0) {
    return { state: "PARTIALLY_PAID", totalPaidMinor };
  }
  return { state: "UNPAID", totalPaidMinor };
}

export function buildShadowReport(input: {
  order: ShadowOrderRow;
  payments: ShadowPaymentRow[];
  intent?: ShadowIntentRow | null;
}): ShadowReport {
  const { order, payments, intent } = input;
  const totalMinor = toMinorUnits(Number(order.total || 0));
  const lines = payments.map(mapPaymentRowToSettlementLine);
  const canonical = computeOrderPaymentState({
    totalMinor,
    lines,
    orderStatus: order.status,
  });
  const legacy = evaluateLegacyOrder(order, payments);

  const differences: ShadowDifference[] = [];
  if (legacy.state !== canonical.state) {
    differences.push({ field: "orderState", legacy: legacy.state, canonical: canonical.state });
  }
  if (legacy.totalPaidMinor !== canonical.netPaidMinor) {
    differences.push({
      field: "netPaidMinor",
      legacy: legacy.totalPaidMinor,
      canonical: canonical.netPaidMinor,
    });
  }

  if (intent) {
    if (intent.amountCents !== totalMinor) {
      differences.push({
        field: "intentAmount",
        legacy: intent.amountCents,
        canonical: totalMinor,
      });
    }
    if (intent.orderId && intent.orderId !== order.id) {
      differences.push({
        field: "intentOrder",
        legacy: intent.orderId,
        canonical: order.id,
      });
    }
    if (order.branchId && intent.merchantId !== order.branchId) {
      differences.push({
        field: "intentBranch",
        legacy: intent.merchantId,
        canonical: order.branchId,
      });
    }
    const canonicalIntentStatus = toCanonicalIntentStatus(intent.status);
    if (canonical.state === "PAID" && canonicalIntentStatus !== "SUCCEEDED") {
      differences.push({
        field: "intentStatus",
        legacy: intent.status,
        canonical: canonicalIntentStatus,
      });
    }
  }

  return {
    orderId: order.id,
    intentId: intent?.id,
    currency: "MXN",
    totalMinor,
    legacy: {
      state: legacy.state,
      totalPaidMinor: legacy.totalPaidMinor,
      orderStatus: String(order.status || ""),
    },
    canonical,
    differences,
    matches: differences.length === 0,
    createdAt: new Date().toISOString(),
  };
}

/** Registra solo diferencias (no invasivo: no escribe en DB). */
export function recordShadowReport(report: ShadowReport): void {
  if (report.matches) return;
  recentShadowDiffs.unshift(report);
  if (recentShadowDiffs.length > MAX_RECENT) recentShadowDiffs.pop();
  console.warn("[SHADOW_PAYMENT_DIFF]", JSON.stringify(report));
}

export function getRecentShadowDiffs(): ShadowReport[] {
  return [...recentShadowDiffs];
}

export function clearRecentShadowDiffs(): void {
  recentShadowDiffs.length = 0;
}
