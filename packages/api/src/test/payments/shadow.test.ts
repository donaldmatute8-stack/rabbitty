import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildShadowReport,
  clearRecentShadowDiffs,
  evaluateLegacyOrder,
  getRecentShadowDiffs,
  mapPaymentRowToSettlementLine,
  recordShadowReport,
} from "../../services/payments/shadow";

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "o1",
  branchId: "b1",
  total: 100,
  status: "PENDING_PAYMENT",
  bunzPaid: 0,
  ...overrides,
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  orderId: "o1",
  amount: 100,
  method: "CASH",
  status: "COMPLETED",
  reference: null,
  ...overrides,
});

describe("RP-0.2 — shadow mode", () => {
  beforeEach(() => {
    clearRecentShadowDiffs();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("mapeo de líneas", () => {
    it("detecta cargo Stripe, terminal externa y Bunz", () => {
      const stripe = mapPaymentRowToSettlementLine(payment({ method: "CREDIT_CARD", reference: "ch_123" }));
      expect(stripe.reference).toMatchObject({ provider: "STRIPE", chargeId: "ch_123" });
      expect(stripe.method).toBe("CARD");

      const terminal = mapPaymentRowToSettlementLine(payment({ method: "CREDIT_CARD", reference: "AUTH-99" }));
      expect(terminal.reference).toMatchObject({ provider: "EXTERNAL_TERMINAL", terminalReference: "AUTH-99" });

      const bunz = mapPaymentRowToSettlementLine(payment({ method: "BUNZ", reference: "RESERVE:r1" }));
      expect(bunz.reference).toMatchObject({ provider: "INTERNAL" });
      expect(bunz.method).toBe("BUNZ");
    });

    it("conserva el signo de los reembolsos", () => {
      const refund = mapPaymentRowToSettlementLine(
        payment({ amount: -30, method: "CREDIT_CARD", status: "REFUNDED", reference: "ch_123" })
      );
      expect(refund.amountMinor).toBe(-3000);
      expect(refund.status).toBe("REFUNDED");
    });
  });

  describe("predicado legacy", () => {
    it("marca pagada, parcial y anulada", () => {
      expect(evaluateLegacyOrder(order(), [payment()]).state).toBe("PAID");
      expect(evaluateLegacyOrder(order(), [payment({ amount: 40 })]).state).toBe("PARTIALLY_PAID");
      expect(evaluateLegacyOrder(order({ status: "CANCELLED" }), [payment()]).state).toBe("VOID");
      expect(evaluateLegacyOrder(order({ status: "COMPLETED" }), []).state).toBe("PAID");
    });
  });

  describe("reporte", () => {
    it("coincide con efectivo completo", () => {
      const report = buildShadowReport({ order: order(), payments: [payment()] });
      expect(report.matches).toBe(true);
      expect(report.canonical.state).toBe("PAID");
    });

    it("detecta tarjeta sin referencia (legacy PAID vs canónico UNPAID)", () => {
      const report = buildShadowReport({
        order: order(),
        payments: [payment({ method: "CREDIT_CARD", reference: null })],
      });
      expect(report.matches).toBe(false);
      expect(report.legacy.state).toBe("PAID");
      expect(report.canonical.state).toBe("UNPAID");
      expect(report.differences.some((d) => d.field === "orderState")).toBe(true);
    });

    it("detecta reembolso que el legacy ignora", () => {
      const report = buildShadowReport({
        order: order(),
        payments: [
          payment({ method: "CREDIT_CARD", reference: "ch_123" }),
          payment({ id: "p2", amount: -100, method: "CREDIT_CARD", status: "REFUNDED", reference: "ch_123" }),
        ],
      });
      expect(report.canonical.state).toBe("REFUNDED");
      expect(report.matches).toBe(false);
    });

    it("detecta discrepancias de intent (monto/sucursal)", () => {
      const report = buildShadowReport({
        order: order(),
        payments: [payment()],
        intent: {
          id: "pi_1",
          orderId: "o1",
          merchantId: "b2",
          status: "SUCCEEDED",
          amountCents: 9000,
          netFiatCents: 9000,
          bunzAmount: 0,
          currency: "MXN",
        },
      });
      expect(report.matches).toBe(false);
      expect(report.differences.some((d) => d.field === "intentAmount")).toBe(true);
      expect(report.differences.some((d) => d.field === "intentBranch")).toBe(true);
    });
  });

  describe("buffer de diferencias", () => {
    it("solo guarda diferencias", () => {
      recordShadowReport(buildShadowReport({ order: order(), payments: [payment()] }));
      expect(getRecentShadowDiffs()).toHaveLength(0);

      recordShadowReport(
        buildShadowReport({ order: order(), payments: [payment({ method: "CREDIT_CARD", reference: null })] })
      );
      expect(getRecentShadowDiffs()).toHaveLength(1);
    });
  });
});
