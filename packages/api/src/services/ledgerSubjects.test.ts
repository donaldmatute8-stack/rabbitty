import { describe, expect, it } from "vitest";
import { biz, canonicalSubject, normalizeLedgerSubject, sys, usr } from "./ledgerSubjects";

/**
 * El ledger rechaza sujetos no canónicos con un CHECK. Un UUID pelado o un
 * literal heredado hacía fallar el INSERT y tumbaba la operación completa:
 * así se rompieron el canje y el cobro con Bunz. Esta normalización es la
 * última defensa antes de escribir.
 */
describe("sujetos canónicos del ledger", () => {
  it("respeta un sujeto ya canónico", () => {
    expect(normalizeLedgerSubject("usr_123")).toBe("usr_123");
    expect(normalizeLedgerSubject("biz_fb7f4847-920f-4482-8ae3-c810a20e75ad")).toBe(
      "biz_fb7f4847-920f-4482-8ae3-c810a20e75ad",
    );
    expect(normalizeLedgerSubject("sys_growth_fund")).toBe("sys_growth_fund");
  });

  it("mapea literales de sistema heredados", () => {
    expect(normalizeLedgerSubject("SYSTEM")).toBe("sys_treasury");
    expect(normalizeLedgerSubject("system")).toBe("sys_treasury");
    expect(normalizeLedgerSubject("TREASURY")).toBe("sys_treasury");
    expect(normalizeLedgerSubject("POS")).toBe("sys_pos");
    expect(normalizeLedgerSubject("POS_CHECKOUT")).toBe("sys_pos_checkout");
    expect(normalizeLedgerSubject("POS_CLAIM")).toBe("sys_pos_claim");
  });

  it("falla claro con un UUID sin prefijo (no adivina usr/biz)", () => {
    expect(() => normalizeLedgerSubject("fb7f4847-920f-4482-8ae3-c810a20e75ad")).toThrow(
      /INVALID_LEDGER_SUBJECT/,
    );
  });

  it("falla claro con cualquier otra basura", () => {
    expect(() => normalizeLedgerSubject("")).toThrow(/INVALID_LEDGER_SUBJECT/);
    expect(() => normalizeLedgerSubject("biz 1")).toThrow(/INVALID_LEDGER_SUBJECT/);
  });

  it("los helpers usr/biz/sys siguen produciendo el prefijo correcto", () => {
    expect(usr("abc")).toBe("usr_abc");
    expect(biz("abc")).toBe("biz_abc");
    expect(sys("treasury")).toBe("sys_treasury");
    // No duplican prefijo.
    expect(biz("biz_abc")).toBe("biz_abc");
    expect(biz("usr_abc")).toBe("biz_abc");
  });

  it("canonicalSubject rechaza vacíos y 'unknown'", () => {
    expect(() => canonicalSubject("usr", "")).toThrow(/INVALID_LEDGER_SUBJECT/);
    expect(() => canonicalSubject("biz", "unknown")).toThrow(/INVALID_LEDGER_SUBJECT/);
  });
});
