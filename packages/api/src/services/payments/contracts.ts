/**
 * ── Rabbitty Pay · Contratos canónicos (RP-0.1) ────────────────────────────
 *
 * Fuente única de verdad para estados, métodos, montos y reglas de liquidación.
 *
 * IMPORTANTE: este módulo es **puro** (sin DB, sin Stripe, sin efectos).
 * No cambia el comportamiento de los motores existentes; solo define el
 * lenguaje compartido que usarán los adapters y, más adelante, shadow mode.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Estados y métodos
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentIntentStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PROCESSING"
  | "SUCCEEDED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

/** Estados legacy de paymentIntentDomain / paymentCore / api-server. */
export type LegacyPaymentIntentStatus =
  | "CREATED"
  | "PENDING"
  | "PENDING_PAYMENT"
  | "AUTHORIZED"
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "SETTLED"
  | "SUCCEEDED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "EXTERNAL_TERMINAL"
  | "BUNZ"
  | "MEMBERSHIP_CREDIT"
  | "STARS"
  | "MIXED"
  | "UNKNOWN";

export type LegacyPaymentMethod =
  | "CASH"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "BUNZ"
  | "MEMBERSHIP_CREDIT"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "EXTERNAL_TERMINAL"
  | "STARS";

export type PaymentCurrency = "MXN" | "USD";

export type OrderPaymentState =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "VOID";

// ─────────────────────────────────────────────────────────────────────────────
// Identificadores
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentIds {
  merchantId?: string;
  branchId: string;
  orderId?: string;
  customerId?: string;
  intentId?: string;
  /** Quién crea el cobro (POS, terminal, sistema). */
  creatorId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dinero
// ─────────────────────────────────────────────────────────────────────────────

/** Decimales por moneda. Los montos canónicos SIEMPRE viven en unidades menores. */
export const CURRENCY_DECIMALS: Record<PaymentCurrency, number> = {
  MXN: 2,
  USD: 2,
};

/** 1 Bunz = 1 MXN (decisión de producto R1). Bunz se maneja en enteros. */
export const BUNZ_PER_MXN = 1;

export interface Money {
  /** Entero en unidades menores (centavos). Nunca float. */
  amountMinor: number;
  currency: PaymentCurrency;
}

export interface PaymentAmounts {
  /** Total de la orden (consumo + propina), en unidades menores. */
  total: Money;
  /** Parte cobrada en fiat, en unidades menores. */
  fiat: Money;
  /** Parte pagada con Bunz (entero). */
  bunz: number;
  /** Propina, separada del consumo. */
  tip: Money;
  /** Comisión de plataforma (fiat). */
  platformFee: Money;
}

export interface PaymentReference {
  provider: "STRIPE" | "EXTERNAL_TERMINAL" | "INTERNAL" | "NONE";
  /** pi_... / ch_... / terminal reference. */
  externalId?: string;
  chargeId?: string;
  terminalReference?: string;
}

export interface CanonicalPaymentIntent {
  id: string;
  ids: PaymentIds;
  status: PaymentIntentStatus;
  method: PaymentMethod;
  amounts: PaymentAmounts;
  reference: PaymentReference;
  idempotencyKey: string;
  expiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
}

export interface PaymentResult {
  ok: boolean;
  status: PaymentIntentStatus;
  orderState: OrderPaymentState;
  intentId: string;
  amounts?: PaymentAmounts;
  error?: string;
}

/** Estados de orden legacy que seguimos leyendo (no son estados de intent). */
export const ORDER_STATUS = {
  PENDING: "PENDING",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  CASH_REQUESTED: "CASH_PAYMENT_REQUESTED",
  COMPLETED: "COMPLETED",
  PAID: "PAID",
  VOID: "VOID",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export function isCashPaymentRequested(status: string): boolean {
  return String(status).toUpperCase() === ORDER_STATUS.CASH_REQUESTED;
}

/** ¿La orden ya está pagada? (un solo lugar para POS, web y kiosco). */
export function isOrderPaidStatus(status: string): boolean {
  const s = String(status).toUpperCase();
  return s === ORDER_STATUS.COMPLETED || s === ORDER_STATUS.PAID;
}

/** ¿La orden ya no admite cobros? */
export function isOrderClosedStatus(status: string): boolean {
  const s = String(status).toUpperCase();
  return [
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.PAID,
    ORDER_STATUS.VOID,
    "VOIDED",
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.EXPIRED,
    "REFUNDED",
    "PARTIALLY_REFUNDED",
  ].includes(s);
}

export function isOrderPayableStatus(status: string): boolean {
  return !isOrderClosedStatus(status);
}

/**
 * Traduce el método de la UI del POS al valor legacy que espera la DB
 * (`CREDIT_CARD`, `DEBIT_CARD`, `BUNZ`, `CASH`). No cambia la UI ni el schema.
 */
export function toLegacyPosPaymentMethod(
  method: string
): "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "BUNZ" {
  const m = String(method).toUpperCase();
  if (m.includes("DEBIT")) return "DEBIT_CARD";
  if (m.includes("BUNZ") || m.includes("QR")) return "BUNZ";
  if (m.includes("TARJETA") || m.includes("CREDIT")) return "CREDIT_CARD";
  return "CASH";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de dinero
// ─────────────────────────────────────────────────────────────────────────────

export function assertCurrency(currency: string): PaymentCurrency {
  if (currency !== "MXN" && currency !== "USD") {
    throw new Error(`CURRENCY_NOT_SUPPORTED: ${currency}`);
  }
  return currency;
}

/** Convierte un monto decimal (19.99) a unidades menores (1999). */
export function toMinorUnits(amount: number, currency: PaymentCurrency = "MXN"): number {
  if (!Number.isFinite(amount)) throw new Error("AMOUNT_NOT_FINITE");
  const factor = 10 ** CURRENCY_DECIMALS[assertCurrency(currency)];
  return Math.round((Number(amount) + Number.EPSILON) * factor);
}

/** Convierte unidades menores a decimal (1999 → 19.99). */
export function fromMinorUnits(amountMinor: number, currency: PaymentCurrency = "MXN"): number {
  if (!Number.isInteger(amountMinor)) throw new Error("AMOUNT_MINOR_NOT_INTEGER");
  const factor = 10 ** CURRENCY_DECIMALS[assertCurrency(currency)];
  return Math.round(amountMinor) / factor;
}

/** Formatea un monto canónico para UI (sin tocar la lógica de cobro). */
export function formatMoney(money: Money, locale = "es-MX"): string {
  const decimals = CURRENCY_DECIMALS[assertCurrency(money.currency)];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fromMinorUnits(money.amountMinor, money.currency));
}

export function assertMoney(money: Money, field = "money"): void {
  if (!Number.isInteger(money.amountMinor)) {
    throw new Error(`${field}: AMOUNT_MINOR_NOT_INTEGER`);
  }
  if (money.amountMinor < 0) {
    throw new Error(`${field}: AMOUNT_NEGATIVE`);
  }
  assertCurrency(money.currency);
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor - b.amountMinor;
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`CURRENCY_MISMATCH: ${a.currency} vs ${b.currency}`);
  }
}

/** Bunz canónico: entero ≥ 0 (sin fracciones). */
export function normalizeBunz(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Split canónico: total = bunz + fiat.
 * `bunz` se expresa en Bunz enteros; su equivalente fiat es `bunz * 100` centavos.
 */
export interface SplitValidation {
  valid: boolean;
  totalMinor: number;
  bunzMinor: number;
  fiatMinor: number;
  reason?: "BUNZ_EXCEEDS_TOTAL" | "CURRENCY_NOT_MXN" | "NEGATIVE_AMOUNT";
}

export function validateSplit(input: {
  totalMinor: number;
  bunz: number;
  currency?: PaymentCurrency;
}): SplitValidation {
  const currency = input.currency ?? "MXN";
  const totalMinor = Math.round(Number(input.totalMinor));
  const bunz = normalizeBunz(input.bunz);
  const bunzMinor = Math.round(bunz * BUNZ_PER_MXN * 100);

  if (currency !== "MXN") {
    return { valid: false, totalMinor, bunzMinor: 0, fiatMinor: 0, reason: "CURRENCY_NOT_MXN" };
  }
  if (totalMinor < 0 || bunz < 0) {
    return { valid: false, totalMinor, bunzMinor, fiatMinor: 0, reason: "NEGATIVE_AMOUNT" };
  }
  if (bunzMinor > totalMinor) {
    return { valid: false, totalMinor, bunzMinor, fiatMinor: 0, reason: "BUNZ_EXCEEDS_TOTAL" };
  }
  return {
    valid: true,
    totalMinor,
    bunzMinor,
    fiatMinor: totalMinor - bunzMinor,
  };
}

export function buildAmounts(input: {
  totalMinor: number;
  bunz?: number;
  tipMinor?: number;
  platformFeeMinor?: number;
  currency?: PaymentCurrency;
}): PaymentAmounts {
  const currency = input.currency ?? "MXN";
  const split = validateSplit({
    totalMinor: input.totalMinor,
    bunz: input.bunz ?? 0,
    currency,
  });
  if (!split.valid) throw new Error(`SPLIT_INVALID: ${split.reason}`);
  return {
    total: { amountMinor: split.totalMinor, currency },
    fiat: { amountMinor: split.fiatMinor, currency },
    bunz: normalizeBunz(input.bunz ?? 0),
    tip: { amountMinor: Math.max(0, Math.round(input.tipMinor ?? 0)), currency },
    platformFee: { amountMinor: Math.max(0, Math.round(input.platformFeeMinor ?? 0)), currency },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeos legacy → canónico
// ─────────────────────────────────────────────────────────────────────────────

export function toCanonicalIntentStatus(status: string): PaymentIntentStatus {
  switch (String(status).toUpperCase()) {
    case "CREATED":
      return "DRAFT";
    case "PENDING":
    case "PENDING_PAYMENT":
      return "PENDING_PAYMENT";
    case "AUTHORIZED":
    case "REQUIRES_ACTION":
    case "PROCESSING":
      return "PROCESSING";
    case "SETTLED":
    case "SUCCEEDED":
      return "SUCCEEDED";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    case "REFUNDED":
      return "REFUNDED";
    case "PARTIALLY_REFUNDED":
      return "PARTIALLY_REFUNDED";
    case "FAILED":
      return "FAILED";
    default:
      // Desconocido = no liquidable (nunca se asume pagado)
      return "FAILED";
  }
}

export function toCanonicalMethod(method: string): PaymentMethod {
  switch (String(method).toUpperCase()) {
    case "CASH":
      return "CASH";
    case "CREDIT_CARD":
    case "DEBIT_CARD":
    case "CARD":
      return "CARD";
    case "APPLE_PAY":
      return "APPLE_PAY";
    case "GOOGLE_PAY":
      return "GOOGLE_PAY";
    case "EXTERNAL_TERMINAL":
      return "EXTERNAL_TERMINAL";
    case "BUNZ":
      return "BUNZ";
    case "MEMBERSHIP_CREDIT":
      return "MEMBERSHIP_CREDIT";
    case "STARS":
      return "STARS";
    case "MIXED":
      return "MIXED";
    default:
      return "UNKNOWN";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Regla única de “orden pagada” (pura, no cableada todavía)
// ─────────────────────────────────────────────────────────────────────────────

export interface SettlementLine {
  amountMinor: number;
  method: PaymentMethod;
  status: "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  reference?: PaymentReference;
}

export interface OrderPaymentEvaluation {
  state: OrderPaymentState;
  /** Cobrado bruto (sin restar reembolsos). */
  grossPaidMinor: number;
  /** Reembolsado (positivo). */
  refundedMinor: number;
  /** Neto aplicado a la orden. */
  netPaidMinor: number;
  remainingMinor: number;
  countedLines: number;
  ignoredLines: number;
}

function lineIsSettled(line: SettlementLine): boolean {
  if (line.status !== "COMPLETED") return false;
  if (line.amountMinor <= 0) return false;

  // Tarjeta: solo cuenta con referencia verificable del procesador/terminal.
  if (line.method === "CARD" || line.method === "APPLE_PAY" || line.method === "GOOGLE_PAY") {
    return Boolean(
      line.reference?.chargeId ||
        line.reference?.externalId ||
        line.reference?.terminalReference
    );
  }
  if (line.method === "EXTERNAL_TERMINAL") {
    return Boolean(line.reference?.terminalReference);
  }
  // Efectivo, Bunz y crédito de membresía: el asiento COMPLETED es la evidencia.
  return true;
}

export function computeOrderPaymentState(input: {
  totalMinor: number;
  currency?: PaymentCurrency;
  lines: SettlementLine[];
  orderStatus?: string;
  /** Si la orden ya fue anulada/cancelada, no puede estar pagada. */
}): OrderPaymentEvaluation {
  const total = Math.max(0, Math.round(input.totalMinor));
  const orderStatus = String(input.orderStatus ?? "").toUpperCase();

  let grossPaidMinor = 0;
  let refundedMinor = 0;
  let countedLines = 0;
  let ignoredLines = 0;

  for (const line of input.lines) {
    if (line.status === "REFUNDED" || line.status === "PARTIALLY_REFUNDED") {
      const refunded = Math.abs(Math.round(line.amountMinor));
      if (refunded > 0) {
        refundedMinor += refunded;
        countedLines++;
      }
      continue;
    }
    if (lineIsSettled(line)) {
      grossPaidMinor += Math.round(line.amountMinor);
      countedLines++;
    } else {
      ignoredLines++;
    }
  }

  const netPaidMinor = Math.max(0, grossPaidMinor - refundedMinor);
  const remainingMinor = Math.max(0, total - netPaidMinor);

  let state: OrderPaymentState;
  if (["VOID", "CANCELLED", "EXPIRED", "REFUNDED"].includes(orderStatus)) {
    state = "VOID";
  } else if (grossPaidMinor <= 0) {
    state = "UNPAID";
  } else if (refundedMinor >= grossPaidMinor) {
    state = "REFUNDED";
  } else if (refundedMinor > 0) {
    state = "PARTIALLY_REFUNDED";
  } else if (netPaidMinor >= total && total >= 0) {
    state = "PAID";
  } else {
    state = "PARTIALLY_PAID";
  }

  return {
    state,
    grossPaidMinor,
    refundedMinor,
    netPaidMinor,
    remainingMinor,
    countedLines,
    ignoredLines,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz del motor (para adapters y shadow mode)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePaymentIntentInput {
  ids: PaymentIds;
  amounts: PaymentAmounts;
  method: PaymentMethod;
  creatorId: string;
  idempotencyKey: string;
  reference?: PaymentReference;
}

export interface PaymentEngine {
  createIntent(input: CreatePaymentIntentInput): Promise<CanonicalPaymentIntent>;
  getIntent(intentId: string): Promise<CanonicalPaymentIntent | null>;
  settleIntent(intentId: string, payerId: string): Promise<PaymentResult>;
  cancelIntent(intentId: string, reason?: string): Promise<PaymentResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparación (shadow mode) — pura, sin efectos
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentDifference {
  field: string;
  legacy: unknown;
  canonical: unknown;
}

export interface PaymentComparison {
  matches: boolean;
  differences: PaymentDifference[];
}

export function comparePaymentIntents(
  legacy: CanonicalPaymentIntent,
  canonical: CanonicalPaymentIntent
): PaymentComparison {
  const differences: PaymentDifference[] = [];

  const check = (field: string, a: unknown, b: unknown) => {
    if (a !== b) differences.push({ field, legacy: a, canonical: b });
  };

  check("intentId", legacy.id, canonical.id);
  check("orderId", legacy.ids.orderId, canonical.ids.orderId);
  check("branchId", legacy.ids.branchId, canonical.ids.branchId);
  check("customerId", legacy.ids.customerId, canonical.ids.customerId);
  check("amountMinor", legacy.amounts.total.amountMinor, canonical.amounts.total.amountMinor);
  check("currency", legacy.amounts.total.currency, canonical.amounts.total.currency);
  check("bunz", legacy.amounts.bunz, canonical.amounts.bunz);
  check("fiatMinor", legacy.amounts.fiat.amountMinor, canonical.amounts.fiat.amountMinor);
  check("method", legacy.method, canonical.method);
  check("status", legacy.status, canonical.status);
  check("externalId", legacy.reference.externalId, canonical.reference.externalId);

  return { matches: differences.length === 0, differences };
}
