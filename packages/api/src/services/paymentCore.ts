import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  orders,
  payments,
  tableSessions,
  paymentIntents,
  bunzReserves,
  paymentProviderEvents,
  orderItems,
  menuItemIngredients,
  inventoryMovements,
  inventoryItems,
  branches,
  restaurants,
  merchantPaymentAccounts,
  ledgerEntries,
  bunzRedemptionAttempts,
  bunzLedgerEntries,
  bunzObligations,
  bunzObligationEvents,
  bunzEconomicLimits,
} from "@rabbitty/database-restaurant/schema";
import { users, ownedBusinesses } from "@rabbitty/database-core/schema";
import { cancelStripePaymentIntent } from "./stripeConnect";
import { isBooksEnabled, recordEmissionBooks, recordRedemptionBooks, recordReversalBooks } from "./bunzBooks";
import { accrueCommission } from "./bunzObligations";
import { checkOperation, resolveAffiliateId } from "./bunzControls";
import { buildShadowReport, recordShadowReport, type ShadowReport } from "./payments/shadow";
import { bus, EventTypes } from "@rabbitty/events";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** TTL por defecto para el checkout de mesa: 10 minutos */
export const DEFAULT_INTENT_TTL_MINUTES = 10;

/** Conversión fija de lealtad: 1 Bunz = 1.00 MXN (100 centavos) */
export const BUNZ_VALUE_CENTS = 100;

/** Redondeo monetario seguro a 2 decimales */
export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Convertir pesos a centavos enteros sin errores de coma flotante */
export const mxnToCents = (amountMxn: number): number => {
  return Math.round(round2(amountMxn) * 100);
};

/** Convertir centavos a pesos con 2 decimales */
export const centsToMxn = (cents: number): number => {
  return round2(cents / 100);
};

/**
 * Genera una clave de idempotencia estable sin timestamps.
 * Dos llamadas idénticas para la misma orden e intento lógico producen el mismo hash.
 */
export function buildPaymentIdempotencyKey(params: {
  branchId: string;
  orderId: string;
  attemptNumber?: number;
}): string {
  const attempt = params.attemptNumber ?? 1;
  const raw = `branch:${params.branchId}:order:${params.orderId}:attempt:${attempt}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface CreatePaymentIntentInput {
  branchId: string;
  orderId: string;
  payerUserId?: string;
  bunzToApply?: number;
  tipMxn?: number;
  attemptNumber?: number;
  provider?: "STRIPE" | "CASH" | "BUNZ_ONLY";
  platformFeePercent?: number; // Ej: 0.01 = 1%
}

export interface PaymentIntentResult {
  intentId: string;
  orderId: string;
  grossAmountCents: number;
  bunzDiscountCents: number;
  bunzApplied: number;
  netFiatCents: number;
  platformFeeCents: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  expiresAt: Date;
  reserveId?: string;
}

/**
 * MOTOR DE PAGO FASE 1:
 * Crea o recupera un Payment Intent con reserva atómica de Bunz (Hold con TTL).
 * Si la clave de idempotencia ya existe, retorna el intento existente sin duplicar.
 */
export async function createOrGetPaymentIntent(
  db: Db,
  input: CreatePaymentIntentInput
): Promise<PaymentIntentResult> {
  // Si el intento vigente de la orden está CANCELLED/EXPIRED, no se reutiliza:
  // se crea uno NUEVO con attempt:(N+1) — antes se devolvía el intento muerto
  // y el checkout colgaba sin poder pagar.
  const liveAttempt = await db
    .select({ id: paymentIntents.id, status: paymentIntents.status })
    .from(paymentIntents)
    .where(and(eq(paymentIntents.orderId, input.orderId), eq(paymentIntents.status, "PENDING_PAYMENT")))
    .limit(1);

  // Cuenta de intentos previos → nuevo attempt number monótono
  let prevCount = 0;
  try {
    const prevRows = (await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(paymentIntents)
      .where(eq(paymentIntents.orderId, input.orderId))
      .limit(1)) as unknown;
    const first = Array.isArray(prevRows) ? prevRows[0] : prevRows;
    prevCount = Number((first as { n?: number | string } | undefined)?.n ?? 0);
  } catch (countErr) {
    console.warn("[PAYMENT] conteo de intents previos falló, uso attempt 1:", countErr);
  }

  const effectiveAttempt =
    liveAttempt.length === 0 ? Math.max(1, prevCount) + 1 : Math.max(1, prevCount);

  const idempotencyKey = buildPaymentIdempotencyKey({
    branchId: input.branchId,
    orderId: input.orderId,
    attemptNumber: effectiveAttempt,
  });

  // 1. Revisar si ya existe un intento para esta misma clave (Idempotencia en DB)
  const [existing] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.idempotencyKey, idempotencyKey))
    .limit(1);

  // Si el intento existente ya liquidó, devolver la referencia;
  // si está en otra fase (PROCESANDO), también devolverla tal cual —
  // el settle/cancel la cambia de estado bajo lock.
  if (existing) {
    const [reserve] = await db
      .select()
      .from(bunzReserves)
      .where(eq(bunzReserves.paymentIntentId, existing.id))
      .limit(1);

    return {
      intentId: existing.id,
      orderId: existing.orderId!,
      grossAmountCents: existing.amountCents,
      bunzDiscountCents: Math.round(existing.bunzAmount * BUNZ_VALUE_CENTS),
      bunzApplied: existing.bunzAmount,
      netFiatCents: existing.netFiatCents,
      platformFeeCents: existing.platformFeeCents,
      currency: existing.currency,
      status: existing.status,
      idempotencyKey: existing.idempotencyKey!,
      expiresAt: existing.expiresAt,
      reserveId: reserve?.id,
    };
  }

  // 2. Ejecutar creación atómica en transacción
  return await db.transaction(async (tx: Db) => {
    // a) Lock de la orden para evitar concurrencia
    const [orderRow] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.branchId, input.branchId)))
      .for("update");

    if (!orderRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada en esta sucursal." });
    }

    const NON_PAYABLE_ORDER_STATUSES = new Set([
      "COMPLETED",
      "PAID",
      "CANCELLED",
      "VOID",
      "EXPIRED",
      "REFUNDED",
      "PARTIALLY_REFUNDED",
    ]);
    if (orderRow.status && NON_PAYABLE_ORDER_STATUSES.has(String(orderRow.status))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Esta orden no admite pagos (estado ${orderRow.status}).`,
      });
    }

    // b) Calcular pagos previos ya acreditados para obtener el saldo pendiente
    const existingPayments = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, input.orderId), eq(payments.status, "COMPLETED")));

    const totalPaidMxn = existingPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
    const orderNetMxn = Math.max(0, Number(orderRow.total || 0) + Number(input.tipMxn || 0) - totalPaidMxn);
    const orderGrossCents = mxnToCents(orderNetMxn);

    if (orderGrossCents <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La orden no tiene saldo pendiente por cobrar." });
    }

    // c) Resolver monto de Bunz solicitado y validar elegibilidad
    const requestedBunz = Math.max(0, round2(input.bunzToApply || 0));
    let bunzToReserve = 0;
    let bunzDiscountCents = 0;

    if (requestedBunz > 0 && input.payerUserId) {
      // Bloquear fila del usuario para lectura y verificación de balance atómica
      const [userRow] = await tx
        .select({
          id: users.id,
          totalBunzEarned: users.totalBunzEarned,
          totalBunzSpent: users.totalBunzSpent,
        })
        .from(users)
        .where(eq(users.id, input.payerUserId))
        .for("update");

      const availableBalance = Math.max(
        0,
        Number((userRow?.totalBunzEarned ?? 0) - (userRow?.totalBunzSpent ?? 0))
      );
      // No permitir usar más Bunz de los disponibles ni más del total de la cuenta
      const maxApplicableBunz = Math.min(availableBalance, centsToMxn(orderGrossCents));
      bunzToReserve = Math.min(requestedBunz, maxApplicableBunz);
      bunzDiscountCents = Math.round(bunzToReserve * BUNZ_VALUE_CENTS);
    }

    // RP-2B: lista blanca + tope de redención (solo si el piloto está activo).
    if (bunzToReserve > 0 && input.payerUserId) {
      const affiliateId = await resolveAffiliateId(tx, input.branchId, { branches, restaurants });
      const control = await checkOperation(tx, {
        affiliateId,
        operation: "redemption",
        amount: bunzToReserve,
        now: new Date(),
        tables: {
          limits: bunzEconomicLimits,
          orders,
          branches,
          restaurants,
          attempts: bunzRedemptionAttempts,
          obligations: bunzObligations,
        },
      });
      if (!control.allowed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `BUNZ_PILOT_BLOCKED: ${control.reason ?? "redención no autorizada"}`,
        });
      }
    }

    // d) Desglose de importes
    const netFiatCents = Math.max(0, orderGrossCents - bunzDiscountCents);
    const platformFeeRate = input.platformFeePercent ?? 0.01; // 1%
    const platformFeeCents = Math.round(netFiatCents * platformFeeRate);

    const expiresAt = new Date(Date.now() + DEFAULT_INTENT_TTL_MINUTES * 60 * 1000);
    const provider = input.provider ?? (netFiatCents === 0 ? "BUNZ_ONLY" : "STRIPE");

    // e) Insertar Payment Intent con centavos enteros
    const [intent] = await tx
      .insert(paymentIntents)
      .values({
        orderId: input.orderId,
        merchantId: input.branchId,
        payerSubjectId: input.payerUserId ?? null,
        amountCents: orderGrossCents,
        bunzAmount: bunzToReserve,
        netFiatCents: netFiatCents,
        platformFeeCents: platformFeeCents,
        amountMxn: centsToMxn(orderGrossCents),
        tipMxn: Math.max(0, Number(input.tipMxn || 0)),
        currency: "MXN",
        provider: provider,
        status: "PENDING_PAYMENT",
        idempotencyKey,
        expiresAt,
      })
      .returning();

    // f) Si hay Bunz aplicados, crear la reserva atómica vinculada
    let reserveId: string | undefined;
    if (bunzToReserve > 0 && input.payerUserId) {
      // Incrementar totalBunzSpent temporalmente para retener el saldo (Hold)
      // D-13 · patrón condicional atómico (U2/U10): la condición de saldo vive
      // en el WHERE, no solo en la lectura previa con FOR UPDATE.
      const held = await tx
        .update(users)
        .set({
          totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${Math.round(bunzToReserve)}`,
        })
        .where(
          and(
            eq(users.id, input.payerUserId),
            sql`COALESCE(${users.totalBunzEarned}, 0) - COALESCE(${users.totalBunzSpent}, 0) >= ${Math.round(bunzToReserve)}`
          )
        )
        .returning({ id: users.id });

      if (held.length === 0) {
        throw new Error("BUNZ_RESERVE_INSUFFICIENT_FUNDS");
      }

      const [res] = await tx
        .insert(bunzReserves)
        .values({
          paymentIntentId: intent.id,
          orderId: input.orderId,
          branchId: input.branchId,
          userId: input.payerUserId,
          amount: bunzToReserve,
          status: "RESERVED",
          expiresAt,
        })
        .returning();

      reserveId = res.id;
    }

    return {
      intentId: intent.id,
      orderId: input.orderId,
      grossAmountCents: orderGrossCents,
      bunzDiscountCents,
      bunzApplied: bunzToReserve,
      netFiatCents,
      platformFeeCents,
      currency: "MXN",
      status: "PENDING_PAYMENT",
      idempotencyKey,
      expiresAt,
      reserveId,
    };
  });
}

/**
 * CONFIRMACIÓN ATÓMICA DE PAGO (Saga Transaccional):
 * Ejecuta el cierre seguro del Payment Intent, captura irrevocable de Bunz,
 * inserción en payments, deducción de inventario y liberación de mesa.
 */
export async function confirmPaymentIntentSettled(
  db: Db,
  params: {
    paymentIntentId: string;
    externalTransactionId?: string;
    verifiedMethod: "STRIPE_CARD" | "APPLE_PAY" | "CASH" | "BUNZ_ONLY";
    expectedAmountCents?: number;
    expectedCurrency?: string;
    /** Sucursal esperada (el campo `merchantId` del intent guarda branchId). */
    expectedBranchId?: string;
    /** Cuenta Connect esperada (destino del cargo). */
    expectedStripeAccountId?: string;
    /** Momento financiero del cobro en Stripe (no el de recepción del webhook). */
    paidAtExternal?: string | Date;
  }
): Promise<{ success: boolean; orderId: string; status: string; recoveryHold?: boolean }> {
  let shadowReport: ShadowReport | null = null;
  const result = await db.transaction(async (tx: Db) => {
    // 1. Lock del Payment Intent
    const [intent] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, params.paymentIntentId))
      .for("update");

    if (!intent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Payment Intent no encontrado." });
    }

    // Validación de negocio del cobro externo contra los registros de Rabbitty
    if (params.expectedAmountCents !== undefined && params.expectedAmountCents !== intent.netFiatCents) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Monto del cobro no coincide. Esperado: ${intent.netFiatCents} centavos, recibido: ${params.expectedAmountCents} centavos.`,
      });
    }

    if (params.expectedCurrency !== undefined && params.expectedCurrency.toUpperCase() !== (intent.currency || "MXN").toUpperCase()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Moneda del cobro no coincide. Esperada: ${intent.currency}, recibida: ${params.expectedCurrency}.`,
      });
    }

    if (params.expectedBranchId !== undefined && params.expectedBranchId !== intent.merchantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Sucursal del cobro no coincide. Esperada: ${intent.merchantId}, recibida: ${params.expectedBranchId}.`,
      });
    }

    // Si ya fue completado previamente, retornar éxito idempotente
    if (intent.status === "SUCCEEDED") {
      return { success: true, orderId: intent.orderId!, status: "SUCCEEDED" };
    }

    // ── P0-2: solo se liquidan intents vigentes ───────────────────────────
    // Un intent cancelado/expirado/fallido no puede producir un cobro: si
    // Stripe ya cobró, el webhook registra la discrepancia para reverso.
    const SETTLEABLE_INTENT_STATUSES = new Set(["PENDING_PAYMENT", "PROCESSING", "REQUIRES_ACTION"]);
    if (!SETTLEABLE_INTENT_STATUSES.has(String(intent.status))) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `SETTLEMENT_NOT_ALLOWED: el intento está en estado ${intent.status}.`,
      });
    }

    // TTL con 5 min de gracia para webhooks que llegan justo al expirar.
    const EXPIRY_GRACE_MS = 5 * 60 * 1000;
    const financialDate = params.paidAtExternal ? new Date(params.paidAtExternal) : new Date();
    const financialMs = Number.isFinite(financialDate.getTime()) ? financialDate.getTime() : Date.now();
    if (intent.expiresAt && financialMs > new Date(intent.expiresAt).getTime() + EXPIRY_GRACE_MS) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `SETTLEMENT_NOT_ALLOWED: el intento expiró el ${new Date(intent.expiresAt).toISOString()}.`,
      });
    }

    // 2. Lock de la orden asociada
    const [orderRow] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, intent.orderId!))
      .for("update");

    if (!orderRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Orden asociada no encontrada." });
    }

    // ── P0-2: la orden debe seguir abierta y ser la misma sucursal ────────
    const CLOSED_ORDER_STATUSES = new Set([
      "COMPLETED",
      "PAID",
      "VOID",
      "CANCELLED",
      "EXPIRED",
      "REFUNDED",
      "PARTIALLY_REFUNDED",
    ]);
    if (orderRow.status && CLOSED_ORDER_STATUSES.has(String(orderRow.status))) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `SETTLEMENT_NOT_ALLOWED: la orden ${orderRow.id} está en estado ${orderRow.status}.`,
      });
    }
    if (orderRow.branchId && intent.merchantId && String(orderRow.branchId) !== String(intent.merchantId)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `SETTLEMENT_NOT_ALLOWED: la orden pertenece a la sucursal ${orderRow.branchId} y el intento a ${intent.merchantId}.`,
      });
    }

    // Cuenta Connect: si el caller conoce el destino del cargo, debe coincidir
    // con la cuenta registrada de la sucursal (evita liquidar en otra cuenta).
    if (params.expectedStripeAccountId && intent.merchantId) {
      const [account] = await tx
        .select({ stripeAccountId: merchantPaymentAccounts.stripeAccountId })
        .from(merchantPaymentAccounts)
        .where(eq(merchantPaymentAccounts.branchId, intent.merchantId))
        .limit(1);
      if (!account || account.stripeAccountId !== params.expectedStripeAccountId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `SETTLEMENT_NOT_ALLOWED: la cuenta Connect del cargo no corresponde a la sucursal ${intent.merchantId}.`,
        });
      }
    }

    // 3. Procesar captura definitiva de reservas de Bunz
    const [reserve] = await tx
      .select()
      .from(bunzReserves)
      .where(eq(bunzReserves.paymentIntentId, intent.id))
      .for("update");

    let isReserveValid = false;
    let isRecoveryHold = false;

    if (reserve && reserve.status === "RESERVED") {
      await tx
        .update(bunzReserves)
        .set({
          status: "CAPTURED",
          capturedAt: new Date(),
        })
        .where(eq(bunzReserves.id, reserve.id));
      isReserveValid = true;
    } else if (reserve && reserve.status === "EXPIRED") {
      // Carrera: el cron lo marcó como EXPIRED antes de la confirmación
      // P0 FIX: Los Bunz ya fueron devueltos al usuario por la expiración.
      // NO se deben acreditar como pagados a la orden ni dar descuento sin respaldo.
      // Se pasa la reserva a RECOVERY_HOLD para auditoría y no se completa la orden si falta saldo.
      await tx
        .update(bunzReserves)
        .set({
          status: "RECOVERY_HOLD",
          failureReason: "Pago confirmado tras expiración de reserva. Saldo Bunz desbalanceado - requiere resolución de supervisor.",
        })
        .where(eq(bunzReserves.id, reserve.id));
      isRecoveryHold = true;
    }

    // 4. Insertar registro de pago fiat si hubo importe con tarjeta/efectivo
    if (intent.netFiatCents > 0) {
      const intentTipMxn = Math.max(0, Number((intent as { tipMxn?: number | null }).tipMxn || 0));
      await tx.insert(payments).values({
        orderId: intent.orderId!,
        method: params.verifiedMethod === "CASH" ? "CASH" : "CREDIT_CARD",
        amount: centsToMxn(intent.netFiatCents),
        // Propina separada para administración/caja (cuenta vs propina)
        tipAmount: intentTipMxn,
        reference: params.externalTransactionId ?? intent.idempotencyKey,
        status: "COMPLETED",
        verificationMethod: params.verifiedMethod === "CASH" ? "CASHIER_CONFIRMED" : "STRIPE_WEBHOOK",
      });
      // Persistir la propina en la orden (idempotente: el settle corre una sola vez)
      if (intentTipMxn > 0) {
        await tx
          .update(orders)
          .set({ tip: sql`COALESCE(${orders.tip}, 0) + ${intentTipMxn}` })
          .where(eq(orders.id, intent.orderId!));
      }
    }

    // 5. Insertar registro de pago con Bunz ÚNICAMENTE si la reserva fue capturada
    //    válidamente Y el afiliado tiene stock (capacidad) para honrarla.
    if (intent.bunzAmount > 0 && isReserveValid) {
      // ── P0-4: consumo atómico del stock del afiliado ───────────────────
      // Sin stock suficiente no se captura el hold: se libera y queda en
      // RECOVERY_HOLD para auditoría (no se inventa capacidad).
      const [branchRow] = await tx
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, intent.merchantId))
        .limit(1);

      const [restRow] = branchRow?.restaurantId
        ? await tx
            .select({ businessId: restaurants.businessId })
            .from(restaurants)
            .where(eq(restaurants.id, branchRow.restaurantId))
            .limit(1)
        : [];

      const businessId = restRow?.businessId;
      const bunzToConsume = Math.floor(Number(intent.bunzAmount || 0));

      let stockConsumed = false;
      if (businessId && bunzToConsume > 0) {
        const consumed = await tx
          .update(ownedBusinesses)
          .set({
            bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) - ${bunzToConsume}`,
          })
          .where(
            and(
              eq(ownedBusinesses.id, businessId),
              sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) >= ${bunzToConsume}`
            )
          )
          .returning({ remaining: ownedBusinesses.bunzBalance });
        stockConsumed = consumed.length > 0;
      }

      if (!stockConsumed) {
        // Liberar el hold del usuario y marcar recuperación
        if (reserve) {
          await tx
            .update(users)
            .set({
              totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - ${Math.round(
                Number(reserve.amount || 0)
              )})`,
            })
            .where(eq(users.id, reserve.userId));

          await tx
            .update(bunzReserves)
            .set({
              status: "RECOVERY_HOLD",
              failureReason:
                "BUNZ_BACKING_INSUFFICIENT: el afiliado no tiene stock para honrar la redención.",
            })
            .where(eq(bunzReserves.id, reserve.id));
        }
        isReserveValid = false;
        isRecoveryHold = true;
      } else {
        // Asiento del consumo de stock (idempotente)
        await tx
          .insert(ledgerEntries)
          .values({
            branchId: intent.merchantId,
            payerSubjectId: `biz_${businessId}`,
            payeeSubjectId: `usr_${reserve?.userId ?? intent.payerSubjectId ?? "unknown"}`,
            amount: bunzToConsume,
            type: "SPEND",
            referenceId: intent.id,
            idempotencyKey: `bunz_stock_${intent.id}`,
            metadata: {
              concept: "BUNZ_REDEMPTION",
              orderId: intent.orderId,
              intentId: intent.id,
            },
          })
          .onConflictDoNothing();

        await tx.insert(payments).values({
          orderId: intent.orderId!,
          method: "BUNZ",
          amount: centsToMxn(Math.round(intent.bunzAmount * BUNZ_VALUE_CENTS)),
          reference: `RESERVE:${reserve?.id || intent.id}`,
          status: "COMPLETED",
          verificationMethod: "INTERNAL_LEDGER",
        });

        await tx
          .update(orders)
          .set({ bunzPaid: (orderRow.bunzPaid || 0) + intent.bunzAmount })
          .where(eq(orders.id, intent.orderId!));

        // OT-1 / OT-3: intento + asientos de la redención (idempotente, no fatal).
        await recordRedemptionBooks(tx, {
          orderId: intent.orderId!,
          branchId: orderRow.branchId,
          bunz: intent.bunzAmount,
          userHash: orderRow.customerId ?? null,
          tables: { attempts: bunzRedemptionAttempts, ledger: bunzLedgerEntries },
        });
      }
    }

    // 6. Verificar total pagado contra la orden
    const allPayments = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, intent.orderId!), eq(payments.status, "COMPLETED")));

    const totalPaidMxn = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const targetPayableAmount = Math.max(0, Number(orderRow.total || 0));

    // Si el total acumulado liquida la orden, marcar como COMPLETED y liberar mesa
    // Si la reserva expiró y está en RECOVERY_HOLD, solo se completa si el fiat por sí solo cubrió el 100%
    if (round2(totalPaidMxn) >= targetPayableAmount) {
      await tx
        .update(orders)
        .set({ status: "COMPLETED" })
        .where(eq(orders.id, intent.orderId!));

      // Liberar sesión de mesa
      if (orderRow.tableId) {
        await tx
          .update(tableSessions)
          .set({ status: "CLOSED", closedAt: new Date() })
          .where(and(eq(tableSessions.tableId, orderRow.tableId), eq(tableSessions.status, "OPEN")));
      }

      // Deducción de stock / recetas
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, intent.orderId!));
      for (const item of items) {
        const ingredients = await tx
          .select()
          .from(menuItemIngredients)
          .where(eq(menuItemIngredients.menuItemId, item.menuItemId));

        for (const ing of ingredients) {
          if (ing.inventoryItemId) {
            const deductionAmount = ing.quantityRequired * item.quantity;
            await tx.insert(inventoryMovements).values({
              itemId: ing.inventoryItemId,
              branchId: intent.merchantId,
              type: "SALE_DEDUCTION",
              quantity: deductionAmount,
              reference: intent.orderId!,
              notes: `Order ${intent.orderId!} completed via Rabbitty Pay`,
            });

            await tx.execute(sql`
              UPDATE inventory_items 
              SET stock = stock - ${deductionAmount} 
              WHERE id = ${ing.inventoryItemId}
            `);
          }
        }
      }
    }

    // ── RP-0.2: snapshot shadow (solo lectura, no altera nada) ───────────
    try {
      shadowReport = buildShadowReport({
        order: {
          id: orderRow.id,
          branchId: orderRow.branchId,
          total: Number(orderRow.total || 0),
          status: String(orderRow.status || ""),
          bunzPaid: orderRow.bunzPaid,
        },
        payments: (allPayments as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          orderId: p.orderId ? String(p.orderId) : undefined,
          amount: Number(p.amount || 0),
          method: String(p.method || ""),
          status: String(p.status || ""),
          reference: p.reference ? String(p.reference) : undefined,
          tipAmount: p.tipAmount ? Number(p.tipAmount) : undefined,
          verificationMethod: p.verificationMethod ? String(p.verificationMethod) : undefined,
        })),
        intent: {
          id: intent.id,
          orderId: intent.orderId,
          merchantId: intent.merchantId,
          status: "SUCCEEDED",
          amountCents: Number(intent.amountCents || 0),
          netFiatCents: Number(intent.netFiatCents || 0),
          bunzAmount: Number(intent.bunzAmount || 0),
          currency: intent.currency,
          externalIntentId: intent.externalIntentId,
        },
      });
    } catch (shadowErr) {
      console.warn("[SHADOW_PAYMENT] no se pudo construir el snapshot:", shadowErr);
    }

    // 7. Actualizar Payment Intent a SUCCEEDED
    await tx
      .update(paymentIntents)
      .set({
        status: "SUCCEEDED",
        externalIntentId: params.externalTransactionId ?? intent.externalIntentId,
        paidAt: new Date(),
      })
      .where(eq(paymentIntents.id, intent.id));

    return {
      success: true,
      orderId: intent.orderId!,
      status: "SUCCEEDED",
      recoveryHold: isRecoveryHold,
    };
  });

  // ── Fase 1 Rabbitty Score (H1): ORDER_PAID también en el canal DIGITAL ──
  // confirmPaymentIntentSettled no emitía ningún evento: el canal Stripe/webhook
  // quedaba sin trigger para el prompt de rating. Aditivo, post-commit,
  // best-effort y con payload completo (los pos.ts históricos solo mandan orderId).
  if (result?.success) {
    try {
      const [paidSnapshot] = await db
        .select({ branchId: orders.branchId, total: orders.total })
        .from(orders)
        .where(eq(orders.id, result.orderId))
        .limit(1);
      bus.emit(EventTypes.ORDER_PAID, {
        orderId: result.orderId,
        branchId: paidSnapshot?.branchId,
        paymentIntentId: params.paymentIntentId,
        externalTransactionId: params.externalTransactionId,
        method: "STRIPE",
        amount: Number(paidSnapshot?.total || 0),
      });
    } catch (emitErr) {
      console.warn("[paymentCore] ORDER_PAID emit falló (no fatal):", emitErr);
    }
  }

  // ── Cashback Bunz automático (Rabbitty Pay / Stripe) ──
  // Idéntico al mint de la vía efectivo/terminal (payOrder): idempotente por
  // ledger key pos_rwd_${orderId} server-side, 1 reintento, y NO-FATAL (si el
  // mint falla, el pago queda liquidado y el cliente reclama con su ticket).
  if (result?.success) {
    try {
      await reconcileOrderCashback(db, { orderId: result.orderId });
    } catch (err) {
      console.error("[STRIPE_CASHBACK_FAIL] orderId=" + result.orderId, err);
    }
  }


  if (shadowReport) {
    try {
      recordShadowReport(shadowReport);
    } catch (shadowErr) {
      console.warn("[SHADOW_PAYMENT] no se pudo registrar:", shadowErr);
    }
  }

  return result;
}

/**
 * ── conciliación de cashback por orden (H8) ──
 * Se usa al liquidar (webhook Stripe) y en re-ejecución manual/admin
 * (POST /api/internal/cashback-reconcile). Cubre el caso en que el intent
 * ganador llegó SIN pagador (intent de la /pay regenerado tras un cancel,
 * o pago desde el link de cuenta) — resuelve al comensal vía:
 *   1) payerSubjectId de cualquier intent vinculado a la orden,
 *   2) fallback a orders.customerId (el POS sí lo vinculó al crear la orden).
 * Idempotente doble: bunzReward>0 ya acreditado → skip; y la ledger key
 * pos_rwd_{orderId} no duplica.
 */
export async function reconcileOrderCashback(
  db: Db,
  params: { orderId: string }
): Promise<{ minted: boolean; bunz?: number; skipped?: "ALREADY_REWARDED" | "NO_PAYER" | "NOT_PAID" | "NO_ORDER" | "NO_FIAT" }> {
  const [order] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      branchId: orders.branchId,
      status: orders.status,
      total: orders.total,
      bunzReward: orders.bunzReward,
      deliveryFee: orders.deliveryFee,
    })
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!order) return { minted: false, skipped: "NO_ORDER" };
  const orderIsPaid = order.status === "COMPLETED" || order.status === "PAID";
  if (!orderIsPaid) return { minted: false, skipped: "NOT_PAID" };
  if (Number(order.bunzReward || 0) > 0) return { minted: false, skipped: "ALREADY_REWARDED" };

  // 1) payer directo de cualquier intent de la orden (los de POS sí lo llevan)
  let payerId: string | null = null;
  const intentRows = await db
    .select({ payerSubjectId: paymentIntents.payerSubjectId })
    .from(paymentIntents)
    .where(eq(paymentIntents.orderId, params.orderId));
  payerId = intentRows.find((r: { payerSubjectId: string | null }) => !!r.payerSubjectId)?.payerSubjectId ?? null;
  // 2) fallback: el comensal vinculado en la orden (canal Enviar Cuenta / /pay)
  if (!payerId) payerId = order.customerId ?? null;
  // 3) Coherencia (H8): el destinatario del cashback SIEMPRE es el comensal de
  //    la orden — si el payer del intent difiere del customerId duradero
  //    (p. ej. rebind en POS tras crear el intent), gana el customerId.
  if (payerId && order.customerId && payerId !== order.customerId) {
    console.warn(`[CASHBACK_RECONCILE] orderId=${order.id} payer del intent ≠ customerId — uso el customerId (${order.customerId})`);
    payerId = order.customerId;
  }
  if (!payerId) return { minted: false, skipped: "NO_PAYER" };

  // 4) Cashback SOLO sobre la parte FIAT (D-10): si la venta se pagó toda en
  //    Bunz, no hay cashback. fiatMxn = amountMxn − bunzAmount del intent.
  let fiatMxn = Number(order.total || 0);
  if (intentRows.length > 0) {
    const [covered] = await db
      .select({ amountMxn: paymentIntents.amountMxn, bunzAmount: paymentIntents.bunzAmount })
      .from(paymentIntents)
      .where(eq(paymentIntents.orderId, params.orderId))
      .limit(1);
    if (covered) {
      fiatMxn = Math.max(0, Number(covered.amountMxn || 0) - Number(covered.bunzAmount || 0));
    }
  }
  // Decisión de producto: el costo de entrega NO genera cashback hasta que
  // Rabbitty Ride esté integrado. Se descuenta de la base fiat.
  const deliveryFee = Number(order.deliveryFee ?? 0);
  if (deliveryFee > 0) fiatMxn = Math.max(0, fiatMxn - deliveryFee);

  if (fiatMxn <= 0) return { minted: false, skipped: "NO_FIAT" };

  // businessId del comercio (branches → restaurants.businessId), fallback del branchId
  let businessId: string = order.branchId;
  if (order.branchId) {
    const [branch] = await db
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, order.branchId))
      .limit(1);
    if (branch?.restaurantId) {
      const [rest] = await db
        .select({ businessId: restaurants.businessId })
        .from(restaurants)
        .where(eq(restaurants.id, branch.restaurantId))
        .limit(1);
      if (rest?.businessId) businessId = rest.businessId;
    }
  }

  const attemptReward = async (): Promise<{ success: boolean; bunz?: number } | null> => {
    const { miniappClient } = await import("./miniapp-client");
    try {
      return await miniappClient.rewardBunz(payerId!, fiatMxn, order.id, businessId);
    } catch (firstErr) {
      console.error("[CASHBACK_RECONCILE] orderId=" + order.id + " intento 1:", firstErr);
      await new Promise((r) => setTimeout(r, 800));
      return await miniappClient.rewardBunz(payerId!, fiatMxn, order.id, businessId);
    }
  };
  let res: Awaited<ReturnType<typeof attemptReward>> = null;
  try {
    res = await attemptReward();
  } catch (secondErr) {
    console.error("[CASHBACK_RECONCILE] orderId=" + order.id + " intento 2 definitivo:", secondErr);
  }
  if (res?.success) {
    await db
      .update(orders)
      .set({ bunzReward: res.bunz ?? 0 })
      .where(eq(orders.id, order.id));

    // OT-3: emisión al cobrar (idempotente, no fatal).
    await recordEmissionBooks(db, {
      orderId: order.id,
      bunz: res.bunz ?? 0,
      tables: { ledger: bunzLedgerEntries },
    });

    // OT-2: devengo de comisión (idempotente, no fatal).
    await accrueCommission(db, {
      orderId: order.id,
      affiliateId: businessId,
      fiatAmount: fiatMxn,
      tables: { obligations: bunzObligations, events: bunzObligationEvents },
    });
    return { minted: true, bunz: res.bunz ?? 0 };
  }
  return { minted: false };
}

/**
 * Reversión genérica de los asientos de un pedido por tipo (`reward`/`redemption`).
 * Idempotente y no fatal: si falla, el reembolso sigue.
 */
export async function reverseOrderLedger(
  db: Db,
  { orderId, types }: { orderId: string; types: string[] }
): Promise<{ ok: boolean; errors: string[] }> {
  if (!isBooksEnabled()) return { ok: true, errors: [] };
  try {
    const entries = await db
      .select()
      .from(bunzLedgerEntries)
      .where(and(eq(bunzLedgerEntries.refId, orderId), inArray(bunzLedgerEntries.refType, types)));
    return await recordReversalBooks(db, { original: entries, tables: { ledger: bunzLedgerEntries } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzBooks] reversión de ${orderId} no registrada (no fatal): ${msg}`);
    return { ok: false, errors: [msg] };
  }
}

/**
 * CANCELACIÓN O LIBERACIÓN DE RESERVA ANTE FALLO:
 * Si el usuario cancela o el cobro con tarjeta falla, libera de inmediato los Bunz reservados.
 */
export async function releasePaymentIntentHold(
  db: Db,
  params: {
    paymentIntentId: string;
    reason: string;
    callerUserId?: string;
  }
): Promise<{ released: boolean; refundedBunz: number }> {
  return await db.transaction(async (tx: Db) => {
    const [intent] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, params.paymentIntentId))
      .for("update");

    if (!intent) return { released: false, refundedBunz: 0 };

    // Si viene un usuario autenticado y la reserva tiene dueño, asegurar ownership
    if (params.callerUserId && intent.payerSubjectId && intent.payerSubjectId !== params.callerUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tienes autorización para cancelar este intento de pago.",
      });
    }

    if (intent.status === "SUCCEEDED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No se puede liberar un intento de pago que ya fue cobrado exitosamente.",
      });
    }

    // ── P0-1: anular también el PaymentIntent en Stripe ──────────────────
    // Sin esto, el client_secret sigue vivo y el comensal puede pagar después
    // aunque el cajero ya canceló (doble cobro). Flag para apagarlo en emergencia.
    const cancelStripeEnabled = process.env.RABBITTY_PAY_CANCEL_STRIPE !== "0";
    if (
      cancelStripeEnabled &&
      intent.provider === "STRIPE" &&
      intent.externalIntentId &&
      process.env.STRIPE_SECRET_KEY
    ) {
      const result = await cancelStripePaymentIntent(intent.externalIntentId);
      if (result === "succeeded") {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "El pago ya fue cobrado en Stripe; no se puede cancelar. Revisa el cobro antes de continuar.",
        });
      }
    }

    let refundedBunz = 0;
    const [reserve] = await tx
      .select()
      .from(bunzReserves)
      .where(eq(bunzReserves.paymentIntentId, intent.id))
      .for("update");

    if (reserve && reserve.status === "RESERVED") {
      refundedBunz = Number(reserve.amount || 0);

      // Reembolsar el saldo al usuario liberando el gasto temporal
      await tx
        .update(users)
        .set({
          totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - ${Math.round(refundedBunz)})`,
        })
        .where(eq(users.id, reserve.userId));

      await tx
        .update(bunzReserves)
        .set({
          status: "RELEASED",
          releasedAt: new Date(),
          failureReason: params.reason,
        })
        .where(eq(bunzReserves.id, reserve.id));
    }

    await tx
      .update(paymentIntents)
      .set({
        status: "CANCELLED",
      })
      .where(eq(paymentIntents.id, intent.id));

    return { released: true, refundedBunz };
  });
}

/**
/**
 * DEDUPLICACIÓN DE EVENTOS DE PROVEEDOR (Once-and-only-once en DB con Ciclo de Vida Recuperable):
 * 1. Inserta el evento en estado 'PROCESSING' o recupera el existente.
 * 2. Si ya estaba en 'COMPLETED', retorna alreadyCompleted = true (200 OK seguro ante replay).
 * 3. Si estaba en 'FAILED' o 'PROCESSING' (reintento legítimo tras fallo previo), permite re-procesar.
 */
export async function registerProviderWebhookEvent(
  db: Db,
  params: {
    provider: "STRIPE";
    eventId: string;
    eventType: string;
    paymentIntentId?: string;
    payload: Record<string, any>;
  }
): Promise<{
  isDuplicate: boolean;
  alreadyCompleted: boolean;
  eventRecordId?: string;
}> {
  try {
    const [record] = await db
      .insert(paymentProviderEvents)
      .values({
        provider: params.provider,
        eventId: params.eventId,
        eventType: params.eventType,
        paymentIntentId: params.paymentIntentId ?? null,
        payload: params.payload,
        status: "PROCESSING",
      })
      .returning();

    return {
      isDuplicate: false,
      alreadyCompleted: false,
      eventRecordId: record.id,
    };
  } catch (err: any) {
    const pgErr = err && typeof err === "object" ? (err as { code?: string; message?: string; cause?: { code?: string; message?: string } | undefined; cause_message?: string }) : null;
    const dupCode = pgErr?.code === "23505" || pgErr?.cause?.code === "23505";
    const dupMsg = String(pgErr?.message || "") + String(pgErr?.cause?.message || pgErr?.cause_message || "");
    if (dupCode || dupMsg.includes("duplicate key") || dupMsg.includes("unique") || dupMsg.includes("payment_provider_events_idx")) {
      const [existing] = await db
        .select()
        .from(paymentProviderEvents)
        .where(
          and(
            eq(paymentProviderEvents.provider, params.provider),
            eq(paymentProviderEvents.eventId, params.eventId)
          )
        )
        .limit(1);

      const TERMINAL_WEBHOOK_STATUSES = new Set([
        "COMPLETED",
        "DISCREPANCY",
        "REFUND_PENDING",
        "REFUNDED",
        "RECONCILED",
        "RESOLVED_WITH_EXCEPTION",
      ]);
      if (existing && TERMINAL_WEBHOOK_STATUSES.has(String(existing.status))) {
        return {
          isDuplicate: true,
          alreadyCompleted: true,
          eventRecordId: existing.id,
        };
      }

      // Si existía pero estaba en PROCESSING o FAILED, permitir reintento recuperable
      return {
        isDuplicate: true,
        alreadyCompleted: false,
        eventRecordId: existing?.id,
      };
    }
    throw err;
  }
}

/**
 * Marca el evento de webhook como COMPLETADO exitosamente tras la saga de negocio.
 */
export async function markProviderWebhookEventCompleted(
  db: Db,
  eventId: string,
  paymentIntentId?: string
): Promise<void> {
  await db
    .update(paymentProviderEvents)
    .set({
      status: "COMPLETED",
      paymentIntentId: paymentIntentId ?? undefined,
      errorMessage: null,
      processedAt: new Date(),
    })
    .where(eq(paymentProviderEvents.eventId, eventId));
}

/**
 * Marca el evento de webhook como FALLIDO para que Stripe reintente y el sistema sepa que falló.
 */
export async function markProviderWebhookEventFailed(
  db: Db,
  eventId: string,
  errorMsg: string
): Promise<void> {
  await db
    .update(paymentProviderEvents)
    .set({
      status: "FAILED",
      errorMessage: errorMsg,
      processedAt: new Date(),
    })
    .where(eq(paymentProviderEvents.eventId, eventId));
}


/**
 * ── P0-2: ciclo de vida de discrepancias ──────────────────────────────────
 * Cuando Stripe cobra pero Rabbitty no puede liquidar (orden cerrada, intent
 * vencido, cuenta distinta), el evento no se pierde: queda en DISCREPANCY y
 * sigue un ciclo operativo hasta resolverse.
 */
export type ProviderWebhookDiscrepancyStatus =
  | "DISCREPANCY"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "RECONCILED"
  | "RESOLVED_WITH_EXCEPTION";

export async function markProviderWebhookEventDiscrepancy(
  db: Db,
  params: {
    eventId: string;
    paymentIntentId?: string;
    code: string;
    message: string;
  }
): Promise<void> {
  await db
    .update(paymentProviderEvents)
    .set({
      status: "DISCREPANCY",
      paymentIntentId: params.paymentIntentId ?? undefined,
      errorMessage: `${params.code}: ${params.message}`,
      processedAt: new Date(),
    })
    .where(eq(paymentProviderEvents.eventId, params.eventId));
}

export async function resolveProviderWebhookDiscrepancy(
  db: Db,
  params: {
    eventId: string;
    status: ProviderWebhookDiscrepancyStatus;
    note?: string;
  }
): Promise<void> {
  await db
    .update(paymentProviderEvents)
    .set({
      status: params.status,
      errorMessage: params.note ? `${params.status}: ${params.note}` : undefined,
      processedAt: new Date(),
    })
    .where(eq(paymentProviderEvents.eventId, params.eventId));
}

/**
 * ── P0-7: reverso de un pago con Bunz ─────────────────────────────────────
 * Restaura el saldo del usuario y el stock del afiliado, con asientos
 * idempotentes. Se usa desde payments.refund.
 */
export async function refundBunzPayment(
  db: Db,
  params: { paymentId: string; amountMxn: number; reason?: string }
): Promise<{ refunded: boolean; amount: number }> {
  return await db.transaction(async (tx: Db) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, params.paymentId))
      .for("update");

    if (!payment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Pago no encontrado." });
    }
    if (payment.status === "REFUNDED") {
      return { refunded: false, amount: 0 };
    }

    const original = Math.max(0, Number(payment.amount || 0));
    const amount = Math.min(original, Math.max(0, Math.round(Number(params.amountMxn))));
    if (amount <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Monto de reembolso inválido." });
    }

    // Idempotencia: si ya existe el asiento de reverso, no repetir.
    const [prior] = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `bunz_refund_user_${payment.id}`))
      .limit(1);
    if (prior) return { refunded: false, amount: 0 };

    // Resolver usuario (por reserva o por intent de la orden)
    let userId: string | null = null;
    let merchantId: string | null = null;
    const ref = String(payment.reference ?? "");

    if (ref.startsWith("RESERVE:")) {
      const reserveId = ref.slice("RESERVE:".length);
      const [reserve] = await tx
        .select()
        .from(bunzReserves)
        .where(eq(bunzReserves.id, reserveId))
        .limit(1);
      userId = reserve?.userId ?? null;
    }

    if (payment.orderId) {
      const [intent] = await tx
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.orderId, payment.orderId),
            sql`COALESCE(${paymentIntents.bunzAmount}, 0) > 0`
          )
        )
        .orderBy(desc(paymentIntents.createdAt))
        .limit(1);
      if (!userId) userId = intent?.payerSubjectId ?? null;
      merchantId = intent?.merchantId ?? null;
    }

    if (!userId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "BUNZ_REFUND_UNRESOLVED: no se encontró el usuario del pago con Bunz.",
      });
    }

    // Resolver el afiliado (stock) desde la sucursal del intent/orden
    let businessId: string | null = null;
    let branchId: string | null = null;
    if (payment.orderId) {
      const [ord] = await tx
        .select({ branchId: orders.branchId })
        .from(orders)
        .where(eq(orders.id, payment.orderId))
        .limit(1);
      branchId = ord?.branchId ?? null;
    }
    const effectiveBranchId = branchId ?? merchantId;
    if (effectiveBranchId) {
      const [br] = await tx
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, effectiveBranchId))
        .limit(1);
      if (br?.restaurantId) {
        const [rest] = await tx
          .select({ businessId: restaurants.businessId })
          .from(restaurants)
          .where(eq(restaurants.id, br.restaurantId))
          .limit(1);
        businessId = rest?.businessId ?? null;
      }
    }

    // Restaurar saldo del usuario
    await tx
      .update(users)
      .set({
        totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - ${amount})`,
      })
      .where(eq(users.id, userId));

    // Restaurar stock del afiliado
    if (businessId) {
      await tx
        .update(ownedBusinesses)
        .set({
          bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) + ${amount}`,
        })
        .where(eq(ownedBusinesses.id, businessId));
    }

    // Asientos de reverso (idempotentes)
    await tx
      .insert(ledgerEntries)
      .values([
        {
          branchId: null,
          payerSubjectId: "POS_CHECKOUT",
          payeeSubjectId: `usr_${userId}`,
          amount,
          type: "REFUND",
          referenceId: payment.id,
          idempotencyKey: `bunz_refund_user_${payment.id}`,
          metadata: { concept: "BUNZ_REFUND", reason: params.reason ?? null },
        },
        ...(businessId
          ? [
              {
                branchId: null,
                payerSubjectId: `usr_${userId}`,
                payeeSubjectId: `biz_${businessId}`,
                amount,
                type: "REFUND",
                referenceId: payment.id,
                idempotencyKey: `bunz_refund_stock_${payment.id}`,
                metadata: { concept: "BUNZ_REFUND_STOCK", reason: params.reason ?? null },
              },
            ]
          : []),
      ])
      .onConflictDoNothing();

    // Asiento negativo + estado
    await tx.insert(payments).values({
      orderId: payment.orderId,
      method: "BUNZ",
      amount: -amount,
      reference: `Bunz refund: ${params.reason || "Sin razón"}`,
      status: "REFUNDED",
    });

    await tx
      .update(payments)
      .set({ status: amount >= original ? "REFUNDED" : "PARTIALLY_REFUNDED" })
      .where(eq(payments.id, payment.id));

    // OT-3: reembolso total ⇒ revertir redención y recompensa del pedido.
    if (amount >= original && payment.orderId) {
      await reverseOrderLedger(tx, { orderId: payment.orderId, types: ["reward", "redemption"] });
    }

    return { refunded: true, amount };
  });
}
