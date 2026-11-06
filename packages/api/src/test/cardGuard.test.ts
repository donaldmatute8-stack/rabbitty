import { describe, it, expect } from "vitest";
import { assertCardPaymentAllowed, isCardMethod } from "../services/cardGuard";

describe("P0-3 — tarjeta sin referencia de terminal", () => {
  it("permite efectivo y Bunz sin referencia", () => {
    expect(() => assertCardPaymentAllowed("CASH")).not.toThrow();
    expect(() => assertCardPaymentAllowed("BUNZ")).not.toThrow();
  });

  it("rechaza tarjeta sin referencia", () => {
    expect(() => assertCardPaymentAllowed("CREDIT_CARD")).toThrow(
      /CARD_REQUIRES_TERMINAL_REFERENCE/
    );
    expect(() => assertCardPaymentAllowed("DEBIT_CARD", "  ")).toThrow(
      /CARD_REQUIRES_TERMINAL_REFERENCE/
    );
  });

  it("rechaza una referencia demasiado corta", () => {
    expect(() => assertCardPaymentAllowed("CREDIT_CARD", "12")).toThrow(
      /CARD_REQUIRES_TERMINAL_REFERENCE/
    );
  });

  it("permite tarjeta con referencia verificable", () => {
    expect(() => assertCardPaymentAllowed("CREDIT_CARD", "123456")).not.toThrow();
    expect(() => assertCardPaymentAllowed("DEBIT_CARD", "APROBADA")).not.toThrow();
  });

  it("identifica métodos de tarjeta", () => {
    expect(isCardMethod("CREDIT_CARD")).toBe(true);
    expect(isCardMethod("DEBIT_CARD")).toBe(true);
    expect(isCardMethod("CASH")).toBe(false);
  });
});
