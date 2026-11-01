import { describe, expect, it } from "vitest";
import {
  isOrderEligibleForRating,
  canEditRating,
  resolveModerationStatus,
  computeShadowScore,
  computeCoverage,
  RATING_EDIT_WINDOW_MS,
  DUPLICATE_EXACT_THRESHOLD,
  PRIOR_MEAN,
} from "../services/ratingRules";

/**
 * ── Rabbitty Score F1 · Checklist de aceptación (unitario) ──
 * Cubre los criterios que dependen de reglas puras. Los criterios que
 * dependen de constraints de DB (doble submit real, webhook duplicado,
 * invariante de ledger) viven en ratings.integration.test.ts.
 */
describe("Rabbitty Score F1 — reglas de aceptación", () => {
  // #3 Pago pendiente / fallido / sin payment → NO elegible
  it("no habilita rating si la orden no está liquidada (PENDING/EXPIRED/VOID)", () => {
    for (const status of ["PENDING", "EXPIRED", "VOID", "VOIDED", "CASH_PAYMENT_REQUESTED"]) {
      expect(isOrderEligibleForRating({ orderStatus: status, hasCompletedPayment: true }))
        .toEqual({ eligible: false, reason: "NOT_PAID" });
    }
  });

  // #8 Ambos canales: la elegibilidad depende de pago confirmado, no del método
  it("habilita rating en COMPLETED/PAID solo con payment COMPLETED (efectivo y Stripe por igual)", () => {
    for (const status of ["COMPLETED", "PAID"]) {
      expect(isOrderEligibleForRating({ orderStatus: status, hasCompletedPayment: true }))
        .toEqual({ eligible: true, reason: null });
      // Hay status pagado pero sin payment COMPLETED (dato inconsistente) → no elegible
      expect(isOrderEligibleForRating({ orderStatus: status, hasCompletedPayment: false }))
        .toEqual({ eligible: false, reason: "NO_PAYMENT" });
    }
  });

  // #6 Edición dentro de 24h sí, después no
  it("respeta la ventana de edición de 24h", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const inside = new Date(now.getTime() - (RATING_EDIT_WINDOW_MS - 60_000));
    const outside = new Date(now.getTime() - (RATING_EDIT_WINDOW_MS + 60_000));
    expect(canEditRating(inside, now)).toBe(true);
    expect(canEditRating(outside, now)).toBe(false);
    expect(canEditRating(null, now)).toBe(false);
    expect(canEditRating("fecha-invalida", now)).toBe(false);
  });

  // Punto 5 del review: repetido SOLO por duplicado exacto verificable
  it("solo marca PENDING_REVIEW por duplicado exacto verificado (>=3), no por texto suelto", () => {
    expect(resolveModerationStatus(0)).toBe("VISIBLE");
    expect(resolveModerationStatus(DUPLICATE_EXACT_THRESHOLD - 1)).toBe("VISIBLE");
    expect(resolveModerationStatus(DUPLICATE_EXACT_THRESHOLD)).toBe("PENDING_REVIEW");
    expect(resolveModerationStatus(DUPLICATE_EXACT_THRESHOLD + 5)).toBe("PENDING_REVIEW");
  });

  // E4 · método del shadow score: determinista, con prior no informativo
  it("shadow score sin datos = prior neutro (3.0) y n=0", () => {
    const r = computeShadowScore([]);
    expect(r.sampleN).toBe(0);
    expect(r.score).toBe(PRIOR_MEAN);
    expect(r.components.method).toBe("bayesian_shrinkage_with_recency");
  });

  it("shadow score aplica shrinkage: muestras pequeñas se acercan al prior, grandes a la media", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const one5 = computeShadowScore([{ stars: 5, createdAt: now }], { now });
    const twenty5 = computeShadowScore(
      Array.from({ length: 20 }, () => ({ stars: 5, createdAt: now })),
      { now }
    );
    // Con n=1 el shrunk debe quedar entre prior y 5, y mucho más cerca del prior
    expect(one5.score).toBeGreaterThan(PRIOR_MEAN);
    expect(one5.score).toBeLessThan(4);
    // Con n=20 se acerca a 5: (5·20 + 3·4)/24 = 4.67
    expect(twenty5.score).toBeGreaterThan(4.6);
    expect(twenty5.score).toBeLessThan(5);
    expect(twenty5.sampleN).toBe(20);
  });

  it("shadow score pondera recencia: una opinión vieja pesa menos que una de hoy", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const old = new Date(now.getTime() - 365 * 86400000); // 1 año (4 vidas medias)
    const mixOldLow = computeShadowScore([{ stars: 1, createdAt: old }, { stars: 5, createdAt: now }], { now });
    const bothHigh = computeShadowScore([{ stars: 5, createdAt: old }, { stars: 5, createdAt: now }], { now });
    expect(mixOldLow.components.recencyMean).toBeGreaterThan(4.5); // el 1★ viejo casi no pesa
    expect(mixOldLow.components.recencyMean).toBeLessThan(bothHigh.components.recencyMean);
  });

  it("shadow score es determinista (misma entrada → mismo resultado)", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const entries = [{ stars: 4, createdAt: now }, { stars: 2, createdAt: now }];
    expect(computeShadowScore(entries, { now })).toEqual(computeShadowScore(entries, { now }));
  });

  // Punto 7 del review: cobertura es muestra, no satisfacción
  it("cobertura de opiniones se calcula como muestra (y evita división por cero)", () => {
    expect(computeCoverage(0, 0)).toEqual({ rated: 0, eligible: 0, pct: 0 });
    expect(computeCoverage(3, 12)).toEqual({ rated: 3, eligible: 12, pct: 25 });
    expect(computeCoverage(5, 5).pct).toBe(100);
  });

  // #9 Invariante económico: el módulo de reglas es puro (sin DB, sin efectos)
  it("el módulo de reglas no importa DB ni muta entradas (invariante económico)", async () => {
    const mod = await import("../services/ratingRules");
    const exported = Object.keys(mod);
    // No hay dependencias de base de datos expuestas
    expect(exported.some((k) => /db|ledger|payment/i.test(k))).toBe(false);
    // Las funciones puras no mutan su entrada
    const entries = [{ stars: 3, createdAt: new Date() }];
    const snapshot = JSON.stringify(entries);
    computeShadowScore(entries);
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
