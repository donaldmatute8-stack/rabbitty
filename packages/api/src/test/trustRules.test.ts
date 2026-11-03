import { describe, expect, it } from "vitest";
import {
  computePaymentsComponent,
  computeTabsComponent,
  computeLedgerComponent,
  computePresenceComponent,
  computeTrustShadow,
  TRUST_MIN_PAYMENT_SAMPLE,
  TRUST_MIN_LEDGER_SAMPLE,
  TRUST_WEIGHTS,
  ABUSE_SPEND_EARN_RATIO,
  ABUSE_EARN_WITHOUT_SPEND_BUNZ,
} from "../services/trustRules";

/**
 * ── Rabbitty Score F2 · Unitarios de reglas puras (SHADOW) ──
 * Checklist: muestras mínimas, renormalización de pesos, sospechas de
 * canjes (solo REVISIÓN) y transparencia de cobertura.
 */
describe("Rabbitty Trust F2 — reglas puras", () => {
  describe("componente pagos (completados vs abandonados)", () => {
    it("es insuficiente por debajo de la muestra mínima (" + TRUST_MIN_PAYMENT_SAMPLE + " intent cerrados)", () => {
      expect(computePaymentsComponent({ succeeded: 1, failed: 0, cancelled: 0, expired: 1 }).score).toBeNull();
    });

    it("score = % de pagos sobre los ATRIBUIBLES (D-8: fricción y desconocido no penalizan)", () => {
      const c = computePaymentsComponent({ succeeded: 8, failed: 1, cancelled: 1, expired: 0 });
      // failed ⇒ fricción del proveedor, cancelled ⇒ causa desconocida: ambos fuera del denominador
      expect(c.score).toBe(100);
      expect(c.sampleN).toBe(10);
      expect(c.notes?.rawScore).toBe(80); // vista cruda conservada para comparar en shadow
      expect(c.notes?.attributable).toBe(8);
      expect(c.notes?.abandonment).toEqual({ user: 0, friction: 1, system: 0, unknown: 1 });
    });

    it("D-8: el abandono del USUARIO sí cuenta en contra", () => {
      const c = computePaymentsComponent({ succeeded: 6, failed: 0, cancelled: 0, expired: 2 });
      expect(c.score).toBe(75); // 6 / (6 + 2 expirados del usuario)
      expect(c.notes?.attributable).toBe(8);
      expect(c.notes?.abandonment).toEqual({ user: 2, friction: 0, system: 0, unknown: 0 });
    });

    it("D-8: sin atribución explícita se deriva del estado (heurística declarada)", () => {
      const c = computePaymentsComponent({ succeeded: 5, failed: 2, cancelled: 3, expired: 1 });
      expect(c.notes?.abandonment).toEqual({ user: 1, friction: 2, system: 0, unknown: 3 });
      expect(c.score).toBe(83.33); // 5 / (5 + 1)
    });

    it("0 pagos exitosos ⇒ score 0 (no null — hay muestra)", () => {
      const c = computePaymentsComponent({ succeeded: 0, failed: 3, cancelled: 0, expired: 1 });
      expect(c.score).toBe(0);
      expect(c.sampleN).toBe(4);
    });
  });

  describe("componente tabs huérfanas (solo diagnóstico)", () => {
    it("penaliza proporcional a STALE_TAB compartido con liquidadas", () => {
      const c = computeTabsComponent({ stale: 1, completed: 9 });
      expect(c.score).toBe(90);
    });

    it("es insuficiente con pocas órdenes del sujeto", () => {
      expect(computeTabsComponent({ stale: 1, completed: 1 }).score).toBeNull();
    });
  });

  describe("componente disciplina de canjes (solo revisión)", () => {
    it("insuficiente con " + TRUST_MIN_LEDGER_SAMPLE + "− movimientos", () => {
      expect(computeLedgerComponent({ earnBunz: 50, spendBunz: 20, entryCount: 3 }).score).toBeNull();
    });

    it("banda sana [<= ratio abuso] ⇒ score 100 y suspect false", () => {
      const c = computeLedgerComponent({ earnBunz: 100, spendBunz: 60, entryCount: 10 });
      expect(c.score).toBe(100);
      expect(c.notes?.suspect).toBe(false);
      expect(c.notes?.spendEarnRatio).toBe(0.6);
    });

    it("ratio sobre " + ABUSE_SPEND_EARN_RATIO + " ⇒ suspect (REVIEW, nunca sanción automática)", () => {
      const c = computeLedgerComponent({ earnBunz: 100, spendBunz: 300, entryCount: 12 });
      expect(c.score).toBe(0);
      expect(c.notes?.suspect).toBe(true);
    });

    it("gasta sin haber ganado nunca ⇒ suspect directo", () => {
      const c = computeLedgerComponent({ earnBunz: 0, spendBunz: 40, entryCount: 8 });
      expect(c.score).toBe(0);
      expect(c.notes?.suspect).toBe(true);
      expect(c.notes?.spendEarnRatio).toBeNull();
    });

    it("acumula mucho earn sin redimir ⇒ suspect", () => {
      const c = computeLedgerComponent({ earnBunz: ABUSE_EARN_WITHOUT_SPEND_BUNZ, spendBunz: 0, entryCount: 6 });
      expect(c.score).toBe(0);
      expect(c.notes?.suspect).toBe(true);
    });
  });

  describe("componente presencia honesta", () => {
    it("cuenta sesiones por fuente conocida (gps/scan/geofence) y otras", () => {
      const c = computePresenceComponent({ sessionsBySource: { gps: 4, scan: 2, geofence: 0, other: 1 } });
      expect(c.score).toBe(100);
      expect(c.sampleN).toBe(7);
      expect(c.notes?.bySource).toEqual({ gps: 4, scan: 2, geofence: 0, other: 1 });
    });

    it("0 sesiones ⇒ insuficiente (no penaliza al inactivo por su cuenta)", () => {
      const c = computePresenceComponent({ sessionsBySource: { gps: 0, scan: 0, geofence: 0, other: 0 } });
      expect(c.score).toBeNull();
      expect(c.sampleN).toBe(0);
    });
  });

  describe("score consolidado", () => {
    it("renormaliza pesos cuando un componente es insuficiente", () => {
      // payments=100 (n≥3) y presence=100; ledger insuficiente ⇒ renorm entre payments(.55)+presence(.2)
      const r = computeTrustShadow({
        payments: { succeeded: 5, failed: 0, cancelled: 0, expired: 0 },
        tabs: { stale: 0, completed: 0 },
        ledger: { earnBunz: 0, spendBunz: 0, entryCount: 2 },
        presence: { sessionsBySource: { gps: 3, scan: 0, geofence: 0, other: 0 } },
      });
      const renorm = (100 * TRUST_WEIGHTS.payments + 100 * TRUST_WEIGHTS.presence) / (TRUST_WEIGHTS.payments + TRUST_WEIGHTS.presence);
      expect(r.score).toBe(renorm);
      expect(r.insufficient).toContain("ledger");
      expect(r.insufficient).toContain("tabs");
      expect(r.confidence).toBe("LOW");
    });

    it("confidence NONE y score null cuando nada es suficiente", () => {
      const r = computeTrustShadow({
        payments: { succeeded: 0, failed: 1, cancelled: 0, expired: 0 },
        tabs: { stale: 0, completed: 1 },
        ledger: { earnBunz: 0, spendBunz: 0, entryCount: 0 },
        presence: { sessionsBySource: { gps: 0, scan: 0, geofence: 0, other: 0 } },
      });
      expect(r.score).toBeNull();
      expect(r.confidence).toBe("NONE");
      expect(r.method).toBe("trust_shadow_v1");
    });

    it("todo limpio con muestra amplia ⇒ HIGH y score alto", () => {
      const r = computeTrustShadow({
        payments: { succeeded: 30, failed: 2, cancelled: 1, expired: 1 },
        tabs: { stale: 1, completed: 30 },
        ledger: { earnBunz: 400, spendBunz: 260, entryCount: 34 },
        presence: { sessionsBySource: { gps: 9, scan: 4, geofence: 1, other: 0 } },
      });
      expect(r.components.payments.sampleN).toBe(34);
      expect(r.score).toBeGreaterThan(80);
      expect(r.confidence).toBe("HIGH");
      expect(r.sampleN).toBe(34 + 31 + 34 + 14);
    });

    it("el componente tabs JAMÁS entra al score (diagnóstico independiente)", () => {
      const base = {
        payments: { succeeded: 10, failed: 0, cancelled: 0, expired: 0 },
        ledger: { earnBunz: 100, spendBunz: 50, entryCount: 15 },
        presence: { sessionsBySource: { gps: 2, scan: 0, geofence: 0, other: 0 } },
      };
      const sinTabs = computeTrustShadow({ ...base, tabs: { stale: 0, completed: 0 } });
      const todasHuerfanas = computeTrustShadow({ ...base, tabs: { stale: 10, completed: 5 } });
      // el score consolidado no cambia por las huérfanas…
      expect(sinTabs.score).toBe(todasHuerfanas.score);
      // …pero el diagnóstico sí las refleja (sinTabs insuficiente, huerfanas 33.33)
      expect(sinTabs.components.tabs.score).toBeNull();
      expect(todasHuerfanas.components.tabs.score).toBe(33.33);
    });
  });
});
