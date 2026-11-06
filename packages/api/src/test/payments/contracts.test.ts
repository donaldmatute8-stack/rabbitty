import { describe, it, expect } from "vitest";
import {
  buildAmounts,
  comparePaymentIntents,
  computeOrderPaymentState,
  fromMinorUnits,
  isCashPaymentRequested,
  isOrderClosedStatus,
  isOrderPaidStatus,
  isOrderPayableStatus,
  toCanonicalIntentStatus,
  toCanonicalMethod,
  toLegacyPosPaymentMethod,
  toMinorUnits,
  validateSplit,
  type CanonicalPaymentIntent,
} from "../../services/payments/contracts";

describe("RP-0.1 — contratos canónicos de pago", () => {
  describe("Dinero", () => {
    it("convierte a unidades menores sin errores de flotante", () => {
      expect(toMinorUnits(19.99)).toBe(1999);
      expect(toMinorUnits(0.1 + 0.2)).toBe(30);
      expect(toMinorUnits(270)).toBe(27000);
      expect(fromMinorUnits(1999)).toBe(19.99);
      expect(fromMinorUnits(27000)).toBe(270);
    });

    it("rechaza montos no finitos o minor no entero", () => {
      expect(() => toMinorUnits(Number.NaN)).toThrow(/AMOUNT_NOT_FINITE/);
      expect(() => fromMinorUnits(19.999)).toThrow(/AMOUNT_MINOR_NOT_INTEGER/);
    });

    it("valida un split Bunz + fiat", () => {
      const ok = validateSplit({ totalMinor: 30000, bunz: 120 });
      expect(ok).toMatchObject({ valid: true, bunzMinor: 12000, fiatMinor: 18000 });

      const tooMuch = validateSplit({ totalMinor: 30000, bunz: 400 });
      expect(tooMuch.valid).toBe(false);
      expect(tooMuch.reason).toBe("BUNZ_EXCEEDS_TOTAL");

      const usd = validateSplit({ totalMinor: 30000, bunz: 10, currency: "USD" });
      expect(usd.valid).toBe(false);
      expect(usd.reason).toBe("CURRENCY_NOT_MXN");
    });

    it("construye montos con propina y fee", () => {
      const amounts = buildAmounts({ totalMinor: 30000, bunz: 100, tipMinor: 2000, platformFeeMinor: 100 });
      expect(amounts.total.amountMinor).toBe(30000);
      expect(amounts.fiat.amountMinor).toBe(20000);
      expect(amounts.bunz).toBe(100);
      expect(amounts.tip.amountMinor).toBe(2000);
      expect(amounts.platformFee.amountMinor).toBe(100);
    });
  });

  describe("Estados y métodos", () => {
    it("mapea estados legacy al canónico", () => {
      expect(toCanonicalIntentStatus("CREATED")).toBe("DRAFT");
      expect(toCanonicalIntentStatus("PENDING")).toBe("PENDING_PAYMENT");
      expect(toCanonicalIntentStatus("SETTLED")).toBe("SUCCEEDED");
      expect(toCanonicalIntentStatus("REQUIRES_ACTION")).toBe("PROCESSING");
      expect(toCanonicalIntentStatus("WHATEVER")).toBe("FAILED");
    });

    it("mapea métodos legacy", () => {
      expect(toCanonicalMethod("CREDIT_CARD")).toBe("CARD");
      expect(toCanonicalMethod("DEBIT_CARD")).toBe("CARD");
      expect(toCanonicalMethod("BUNZ")).toBe("BUNZ");
      expect(toCanonicalMethod("CASH")).toBe("CASH");
      expect(toCanonicalMethod("STARS")).toBe("STARS");
      expect(toCanonicalMethod("???")).toBe("UNKNOWN");
    });
  });

  describe("Estados de orden y métodos POS", () => {
    it("detecta pagada, cerrada y pagable", () => {
      expect(isOrderPaidStatus("COMPLETED")).toBe(true);
      expect(isOrderPaidStatus("PAID")).toBe(true);
      expect(isOrderPaidStatus("PENDING_PAYMENT")).toBe(false);

      expect(isOrderClosedStatus("VOID")).toBe(true);
      expect(isOrderClosedStatus("CANCELLED")).toBe(true);
      expect(isOrderClosedStatus("PENDING")).toBe(false);
      expect(isOrderPayableStatus("PENDING_PAYMENT")).toBe(true);
      expect(isOrderPayableStatus("COMPLETED")).toBe(false);
    });

    it("detecta la solicitud de efectivo", () => {
      expect(isCashPaymentRequested("CASH_PAYMENT_REQUESTED")).toBe(true);
      expect(isCashPaymentRequested("COMPLETED")).toBe(false);
    });

    it("traduce métodos de la UI del POS al valor legacy", () => {
      expect(toLegacyPosPaymentMethod("TARJETA_STRIPE")).toBe("CREDIT_CARD");
      expect(toLegacyPosPaymentMethod("TARJETA_EXTERNA")).toBe("CREDIT_CARD");
      expect(toLegacyPosPaymentMethod("DEBITO")).toBe("DEBIT_CARD");
      expect(toLegacyPosPaymentMethod("BUNZ")).toBe("BUNZ");
      expect(toLegacyPosPaymentMethod("QR")).toBe("BUNZ");
      expect(toLegacyPosPaymentMethod("EFECTIVO")).toBe("CASH");
      expect(toLegacyPosPaymentMethod("DIVIDIDA")).toBe("CASH");
    });
  });

  describe("Predicado único de orden pagada", () => {
    it("efectivo completo → PAID; parcial → PARTIALLY_PAID", () => {
      const paid = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [{ amountMinor: 10000, method: "CASH", status: "COMPLETED" }],
      });
      expect(paid.state).toBe("PAID");
      expect(paid.remainingMinor).toBe(0);

      const partial = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [{ amountMinor: 4000, method: "CASH", status: "COMPLETED" }],
      });
      expect(partial.state).toBe("PARTIALLY_PAID");
      expect(partial.remainingMinor).toBe(6000);
    });

    it("Bunz completo → PAID", () => {
      const result = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [{ amountMinor: 10000, method: "BUNZ", status: "COMPLETED" }],
      });
      expect(result.state).toBe("PAID");
    });

    it("tarjeta sin referencia verificable NO cuenta como pagada", () => {
      const result = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [{ amountMinor: 10000, method: "CARD", status: "COMPLETED" }],
      });
      expect(result.state).toBe("UNPAID");
      expect(result.ignoredLines).toBe(1);
    });

    it("tarjeta con cargo o terminal sí cuenta", () => {
      const withCharge = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [
          {
            amountMinor: 10000,
            method: "CARD",
            status: "COMPLETED",
            reference: { provider: "STRIPE", chargeId: "ch_123" },
          },
        ],
      });
      expect(withCharge.state).toBe("PAID");

      const withTerminal = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [
          {
            amountMinor: 10000,
            method: "EXTERNAL_TERMINAL",
            status: "COMPLETED",
            reference: { provider: "EXTERNAL_TERMINAL", terminalReference: "123456" },
          },
        ],
      });
      expect(withTerminal.state).toBe("PAID");
    });

    it("reembolso total y parcial", () => {
      const full = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [
          {
            amountMinor: 10000,
            method: "CARD",
            status: "COMPLETED",
            reference: { provider: "STRIPE", chargeId: "ch_123" },
          },
          { amountMinor: -10000, method: "CARD", status: "REFUNDED" },
        ],
      });
      expect(full.state).toBe("REFUNDED");

      const partial = computeOrderPaymentState({
        totalMinor: 10000,
        lines: [
          {
            amountMinor: 10000,
            method: "CARD",
            status: "COMPLETED",
            reference: { provider: "STRIPE", chargeId: "ch_123" },
          },
          { amountMinor: -3000, method: "CARD", status: "REFUNDED" },
        ],
      });
      expect(partial.state).toBe("PARTIALLY_REFUNDED");
      expect(partial.refundedMinor).toBe(3000);
    });

    it("orden anulada → VOID", () => {
      const result = computeOrderPaymentState({
        totalMinor: 10000,
        orderStatus: "CANCELLED",
        lines: [{ amountMinor: 10000, method: "CASH", status: "COMPLETED" }],
      });
      expect(result.state).toBe("VOID");
    });
  });

  describe("Comparación shadow", () => {
    const base = (overrides: Partial<CanonicalPaymentIntent> = {}): CanonicalPaymentIntent => ({
      id: "pi_1",
      ids: { branchId: "b1", orderId: "o1", intentId: "pi_1" },
      status: "SUCCEEDED",
      method: "BUNZ",
      amounts: buildAmounts({ totalMinor: 10000, bunz: 100 }),
      reference: { provider: "INTERNAL" },
      idempotencyKey: "key_1",
      expiresAt: new Date(0),
      createdAt: new Date(0),
      ...overrides,
    });

    it("detecta coincidencias y diferencias", () => {
      expect(comparePaymentIntents(base(), base()).matches).toBe(true);

      const diff = comparePaymentIntents(base(), base({ status: "PENDING_PAYMENT" }));
      expect(diff.matches).toBe(false);
      expect(diff.differences[0]?.field).toBe("status");
    });
  });
});
