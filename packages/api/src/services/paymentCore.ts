import { and, eq, sql } from "drizzle-orm";
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
} from "@rabbitty/database-restaurant/schema";
import { users } from "@rabbitty/database-core/schema";
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
  const idempotencyKey = buildPaymentIdempotencyKey({
    branchId: input.branchId,
    orderId: input.orderId,
    attemptNumber: input.attemptNumber,
  });

  // 1. Revisar si ya existe un intento para esta misma clave (Idempotencia en DB)
  const [existing] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.idempotencyKey, idempotencyKey))
    .limit(1);

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

    if (orderRow.status === "COMPLETED" || orderRow.status === "PAID") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Esta orden ya se encuentra completamente pagada." });
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
      await tx
        .update(users)
        .set({
          totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${Math.round(bunzToReserve)}`,
        })
        .where(eq(users.id, input.payerUserId));

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
    expectedMerchantId?: string;
  }
): Promise<{ success: boolean; orderId: string; status: string; recoveryHold?: boolean }> {
  return await db.transaction(async (tx: Db) => {
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

    if (params.expectedMerchantId !== undefined && params.expectedMerchantId !== intent.merchantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Comercio del cobro no coincide. Esperado: ${intent.merchantId}, recibido: ${params.expectedMerchantId}.`,
      });
    }

    // Si ya fue completado previamente, retornar éxito idempotente
    if (intent.status === "SUCCEEDED") {
      return { success: true, orderId: intent.orderId!, status: "SUCCEEDED" };
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
      await tx.insert(payments).values({
        orderId: intent.orderId!,
        method: params.verifiedMethod === "CASH" ? "CASH" : "CREDIT_CARD",
        amount: centsToMxn(intent.netFiatCents),
        reference: params.externalTransactionId ?? intent.idempotencyKey,
        status: "COMPLETED",
        verificationMethod: params.verifiedMethod === "CASH" ? "CASHIER_CONFIRMED" : "STRIPE_WEBHOOK",
      });
    }

    // 5. Insertar registro de pago con Bunz ÚNICAMENTE si la reserva fue capturada válidamente
    if (intent.bunzAmount > 0 && isReserveValid) {
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

      if (existing?.status === "COMPLETED") {
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

