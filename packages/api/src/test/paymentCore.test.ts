import { describe, it, expect, vi } from "vitest";
import {
  buildPaymentIdempotencyKey,
  mxnToCents,
  centsToMxn,
  createOrGetPaymentIntent,
  confirmPaymentIntentSettled,
  releasePaymentIntentHold,
  registerProviderWebhookEvent,
} from "../services/paymentCore";

describe("Rabbitty Pay Phase 1 — Motor Transaccional & Hardening", () => {
  describe("1. Precisión Monetaria e Idempotencia Canónica", () => {
    it("convierte importes a centavos y pesos sin errores de coma flotante", () => {
      expect(mxnToCents(270.0)).toBe(27000);
      expect(mxnToCents(300.5)).toBe(30050);
      expect(mxnToCents(19.99)).toBe(1999);
      expect(centsToMxn(27000)).toBe(270.0);
      expect(centsToMxn(30050)).toBe(300.5);
      expect(centsToMxn(1999)).toBe(19.99);
    });

    it("genera claves de idempotencia idénticas para la misma orden e intento lógico (sin timestamps)", () => {
      const key1 = buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 1 });
      const key2 = buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 1 });
      const keyAttempt2 = buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 2 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyAttempt2);
      expect(key1).toHaveLength(64); // SHA-256
    });
  });

  describe("2. Deduplicación de Webhooks (Once-and-only-once en DB)", () => {
    it("registra evento nuevo y detecta duplicados cuando llega el mismo eventId", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn()
              .mockResolvedValueOnce([{ id: "evt_rec_1" }])
              .mockRejectedValueOnce({ code: "23505", message: "duplicate key value violates unique constraint" }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "evt_rec_1", status: "COMPLETED" }]),
            }),
          }),
        }),
      };

      // 1er arribo del evento
      const res1 = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_stripe_12345",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123", amount: 27000 },
      });
      expect(res1.isDuplicate).toBe(false);
      expect(res1.eventRecordId).toBe("evt_rec_1");

      // 2do arribo del mismo webhook (reintento de Stripe)
      const res2 = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_stripe_12345",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123", amount: 27000 },
      });
      expect(res2.isDuplicate).toBe(true);
    });
  });

  describe("3. Idempotencia al Recuperar Payment Intent Existente", () => {
    it("devuelve el intento existente sin duplicar reservas ni filas en DB", async () => {
      const existingIntent = {
        id: "pi_exist_1",
        orderId: "ord_100",
        merchantId: "b1",
        amountCents: 30000,
        bunzAmount: 30,
        netFiatCents: 27000,
        platformFeeCents: 270,
        currency: "MXN",
        status: "PENDING_PAYMENT",
        idempotencyKey: buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 1 }),
        expiresAt: new Date(Date.now() + 600000),
      };

      const existingReserve = {
        id: "res_exist_1",
        paymentIntentId: "pi_exist_1",
        amount: 30,
        status: "RESERVED",
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(table._?.name === "bunz_reserves" ? [existingReserve] : [existingIntent]),
            }),
          })),
        }),
      };

      const result = await createOrGetPaymentIntent(mockDb as any, {
        branchId: "b1",
        orderId: "ord_100",
        payerUserId: "usr_rabbitter",
        bunzToApply: 30,
        attemptNumber: 1,
      });

      expect(result.intentId).toBe("pi_exist_1");
      expect(result.grossAmountCents).toBe(30000);
      expect(result.bunzDiscountCents).toBe(3000);
      expect(result.netFiatCents).toBe(27000);
      expect(result.platformFeeCents).toBe(270);
      expect(result.status).toBe("PENDING_PAYMENT");
    });
  });

  describe("4. Saga de Liberación de Hold de Bunz ante Fallo o Cancelación", () => {
    it("restituye el saldo al usuario liberando la reserva sin tocar órdenes ya pagadas", async () => {
      let capturedUpdates: any[] = [];
      const mockIntent = {
        id: "pi_test_1",
        orderId: "ord_1",
        status: "PENDING_PAYMENT",
      };
      const mockReserve = {
        id: "res_1",
        paymentIntentId: "pi_test_1",
        userId: "usr_1",
        amount: 50,
        status: "RESERVED",
      };

      let callCount = 0;
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockImplementation(() => {
                callCount++;
                // Primer llamada es paymentIntents, segunda es bunzReserves
                return Promise.resolve(callCount === 1 ? [mockIntent] : [mockReserve]);
              }),
            }),
          })),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((val) => {
            capturedUpdates.push(val);
            return { where: vi.fn().mockResolvedValue(true) };
          }),
        }),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      const res = await releasePaymentIntentHold(mockDb as any, {
        paymentIntentId: "pi_test_1",
        reason: "Tarjeta rechazada por emisor bancario",
      });

      expect(res.released).toBe(true);
      expect(res.refundedBunz).toBe(50);
      // Validar que se actualizó el estado a RELEASED y se canceló el intent
      expect(capturedUpdates.some((u) => u.status === "RELEASED")).toBe(true);
      expect(capturedUpdates.some((u) => u.status === "CANCELLED")).toBe(true);
    });

    it("rechaza liberar si el intento ya se encuentra en SUCCEEDED", async () => {
      const mockIntent = {
        id: "pi_paid",
        orderId: "ord_1",
        status: "SUCCEEDED",
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([mockIntent]),
            }),
          }),
        }),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      await expect(
        releasePaymentIntentHold(mockDb as any, {
          paymentIntentId: "pi_paid",
          reason: "Intento de reversión ilegal",
        })
      ).rejects.toThrow("No se puede liberar un intento de pago que ya fue cobrado");
    });
  });

  describe("5. Cierre Seguro de Orden y Recuperación ante Expiración Previa", () => {
    it("si la reserva estaba EXPIRED cuando entra la confirmación, transiciona a RECOVERY_HOLD", async () => {
      const mockIntent = {
        id: "pi_exp_1",
        orderId: "ord_100",
        merchantId: "b1",
        netFiatCents: 27000,
        bunzAmount: 30,
        idempotencyKey: "key_1",
        status: "PENDING_PAYMENT",
      };
      const mockOrder = {
        id: "ord_100",
        total: 300,
        bunzPaid: 0,
      };
      const mockReserveExpired = {
        id: "res_exp",
        paymentIntentId: "pi_exp_1",
        amount: 30,
        status: "EXPIRED", // Expiró en cron segundos antes del webhook
      };

      let reserveStatusSet: string | undefined;
      let bunzPaymentsInserted: any[] = [];
      let orderStatusUpdated: string | undefined;

      let selectStep = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            selectStep++;
            const step = selectStep;
            return {
              where: vi.fn().mockImplementation(() => {
                // Pasos 1, 2, 3 son consultas con .for("update")
                if (step === 1) return { for: vi.fn().mockResolvedValue([mockIntent]) };
                if (step === 2) return { for: vi.fn().mockResolvedValue([mockOrder]) };
                if (step === 3) return { for: vi.fn().mockResolvedValue([mockReserveExpired]) };
                // Paso 4 es allPayments (sin for): solo se insertó el pago fiat de 270 MXN (los Bunz expiraron)
                if (step === 4) {
                  return Promise.resolve([
                    { amount: 270, status: "COMPLETED" },
                  ]);
                }
                // Pasos siguientes son orderItems (vacío)
                return Promise.resolve([]);
              }),
            };
          }),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            if (val.method === "BUNZ") bunzPaymentsInserted.push(val);
            return Promise.resolve(true);
          }),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((val) => {
            if (val.status === "RECOVERY_HOLD") reserveStatusSet = "RECOVERY_HOLD";
            if (val.status === "COMPLETED") orderStatusUpdated = "COMPLETED";
            return { where: vi.fn().mockResolvedValue(true) };
          }),
        }),
        execute: vi.fn().mockResolvedValue(true),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      const res = await confirmPaymentIntentSettled(mockDb as any, {
        paymentIntentId: "pi_exp_1",
        externalTransactionId: "ch_stripe_settled",
        verifiedMethod: "STRIPE_CARD",
        expectedAmountCents: 27000,
        expectedCurrency: "MXN",
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCEEDED");
      expect(res.recoveryHold).toBe(true);
      expect(reserveStatusSet).toBe("RECOVERY_HOLD");
      // P0 FIX: Los Bunz expirados NO se insertan como pago ni se cierra la orden como COMPLETED si falta saldo
      expect(bunzPaymentsInserted.length).toBe(0);
      expect(orderStatusUpdated).toBeUndefined();
    });

    it("rechaza confirmación si el monto recibido no coincide con el intento", async () => {
      const mockIntent = {
        id: "pi_check_1",
        orderId: "ord_100",
        merchantId: "b1",
        netFiatCents: 27000,
        currency: "MXN",
        status: "PENDING_PAYMENT",
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([mockIntent]),
            }),
          }),
        }),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      await expect(
        confirmPaymentIntentSettled(mockDb as any, {
          paymentIntentId: "pi_check_1",
          verifiedMethod: "STRIPE_CARD",
          expectedAmountCents: 15000, // Discrepancia de monto
          expectedCurrency: "MXN",
        })
      ).rejects.toThrow("Monto del cobro no coincide");
    });
  });

  describe("6. Ciclo de Vida Recuperable de Webhooks", () => {
    it("permite reintento si el registro previo estaba en PROCESSING o FAILED", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key" }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "evt_1", status: "FAILED" }]),
            }),
          }),
        }),
      };

      const res = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_failed_retry",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123" },
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.alreadyCompleted).toBe(false);
    });

    it("identifica duplicado real cuando el estado ya es COMPLETED", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key" }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "evt_1", status: "COMPLETED" }]),
            }),
          }),
        }),
      };

      const res = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_done",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123" },
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.alreadyCompleted).toBe(true);
    });
  });
});
