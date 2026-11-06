import { describe, it, expect } from "vitest";
import { validateBunzCoreSettlement } from "../../services/payments/bunzParity";

describe("RP-0.4 — paridad Bunz V2", () => {
  it("acepta cuando el core cubrió toda la cuenta con Bunz", () => {
    expect(
      validateBunzCoreSettlement({ owedMxn: 300, netFiatCents: 0, bunzApplied: 300 })
    ).toEqual({ ok: true });
  });

  it("rechaza si quedó remanente fiat", () => {
    expect(
      validateBunzCoreSettlement({ owedMxn: 300, netFiatCents: 5000, bunzApplied: 250 })
    ).toEqual({ ok: false, error: "INSUFFICIENT_BUNZ" });
  });

  it("rechaza si aplicó menos Bunz de lo debido", () => {
    expect(
      validateBunzCoreSettlement({ owedMxn: 300, netFiatCents: 0, bunzApplied: 299 })
    ).toEqual({ ok: false, error: "INSUFFICIENT_BUNZ" });
  });

  it("rechaza si el afiliado no tenía stock (recovery hold)", () => {
    expect(
      validateBunzCoreSettlement({
        owedMxn: 300,
        netFiatCents: 0,
        bunzApplied: 300,
        recoveryHold: true,
      })
    ).toEqual({ ok: false, error: "INSUFFICIENT_STOCK" });
  });
});
