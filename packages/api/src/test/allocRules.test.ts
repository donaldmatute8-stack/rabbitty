import { describe, expect, it } from "vitest";
import {
  computeAllocationShadow,
  ALLOC_TARGET_UTILIZATION,
  ALLOC_FULL_MOMENTUM_REDEMPTIONS,
  ALLOC_PAUSE_AFTER_DAYS,
  GROWTH_ALLOC_METHOD,
} from "../services/allocRules";
import { PUBLIC_MIN_SAMPLE } from "../services/ratingRules";

/**
 * ── Growth Allocation F3 (SHADOW, code only) ── unitarios de reglas puras.
 * Verifica explicabilidad, renormalización, precedencia de recomendaciones
 * y que el motor JAMÁS pida dinero por sí solo (solo propone al humano).
 */
describe("Growth Allocation F3 — reglas puras", () => {
  const base = {
    merchantShadowScore: 4.2,
    serviceSampleN: 20,
    utilization: 0.6,
    redemptions30d: 10,
    budgetRemainingBunz: 5000,
    campaignAgeDays: 60,
  };

  it("salud total ⇒ score alto y BOOST", () => {
    const r = computeAllocationShadow(base);
    expect(r.score).toBeGreaterThan(80);
    expect(r.recommendation).toBe("BOOST");
    expect(r.confidence).toBe("HIGH");
    expect(r.method).toBe(GROWTH_ALLOC_METHOD);
    expect(r.reasons.some((x) => x.includes("reforzar"))).toBe(true);
  });

  it("shadow del merchant sin muestra (n<5) ⇒ renormaliza y suelta la razón", () => {
    const r = computeAllocationShadow({ ...base, merchantShadowScore: null, serviceSampleN: 1, redemptions30d: 2, utilization: 0.3 });
    expect(r.insufficient).toContain("merchantService");
    expect(r.confidence).toBe("LOW");
    expect(r.score).not.toBeNull(); // renormalita con los otros 2
  });

  it("servicio bajo (<40 implies score<2.6/5) ⇒ NURTURE_SERVICE, no BOOST", () => {
    const r = computeAllocationShadow({ ...base, merchantShadowScore: 2.0 });
    expect(r.recommendation).toBe("NURTURE_SERVICE");
    expect(r.reasons.some((x) => x.includes("mejorar servicio"))).toBe(true);
  });

  it("presupuesto agotado ⇒ REFILL_REQUEST (propuesta, jamás acción automática)", () => {
    const r = computeAllocationShadow({ ...base, budgetRemainingBunz: 0 });
    expect(r.recommendation).toBe("REFILL_REQUEST");
  });

  it(`sin redenciones 30d y ${ALLOC_PAUSE_AFTER_DAYS}+ días ⇒ PAUSE_CANDIDATE`, () => {
    const r = computeAllocationShadow({ ...base, redemptions30d: 0 });
    expect(r.recommendation).toBe("PAUSE_CANDIDATE");
    expect(r.insufficient).toContain("campaignMomentum");
  });

  it("score null cuando TODO insuficiente (campaña fresca)", () => {
    const r = computeAllocationShadow({
      merchantShadowScore: null,
      serviceSampleN: 0,
      utilization: 0,
      redemptions30d: 0,
      budgetRemainingBunz: 1000,
      campaignAgeDays: 2,
    });
    expect(r.score).toBeNull();
    expect(r.confidence).toBe("NONE");
    expect(r.recommendation).toBe("KEEP");
  });

  it("utilización objetivo " + ALLOC_TARGET_UTILIZATION + " y momentum " + ALLOC_FULL_MOMENTUM_REDEMPTIONS + " rinden 100/100", () => {
    const r = computeAllocationShadow({ ...base, merchantShadowScore: null, serviceSampleN: 1 });
    // sin servicio → peso renorm entre efficiency(100) y momentum(100) → 100
    expect(r.score).toBe(100);
  });

  it("score de servicio 3.0/5 (prior bayesiano F1) ancla ~50", () => {
    const eff = computeAllocationShadow({ ...base, merchantShadowScore: 3.0, redemptions30d: 0, utilization: 0 });
    expect(eff.score).toBe(50); // solo servicio contribuye
  });
});
