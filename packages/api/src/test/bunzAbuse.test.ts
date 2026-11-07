import { afterEach, describe, expect, it } from "vitest";
import {
  ABUSE_FLAG,
  BURST_BUNZ,
  detectDiscountStreak,
  detectRedemptionSignals,
  isAbuseEnabled,
  runAbuseDetection,
} from "../services/bunzAbuse";

const at = (iso: string) => new Date(iso);

describe("OT-5 — señales de abuso", () => {
  afterEach(() => delete process.env[ABUSE_FLAG]);

  it("flag apagado por defecto", () => {
    expect(isAbuseEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isAbuseEnabled({ [ABUSE_FLAG]: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("3 redenciones en 24 h ⇒ rapid_redemption", () => {
    const rows = [0, 1, 2].map((i) => ({
      id: `a${i}`,
      userHash: "u1",
      requestedAt: at(`2026-11-01T0${i}:00:00Z`),
      bunzRequested: 100,
    }));
    const s = detectRedemptionSignals(rows);
    expect(s.some((x) => x.type === "rapid_redemption")).toBe(true);
    const rapid = s.find((x) => x.type === "rapid_redemption")!;
    expect(rapid.severity).toBe("medium");
    expect(rapid.id).toBe("sig-rapid-u1-2026-11-01");
  });

  it("6 redenciones ⇒ severidad alta", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`,
      userHash: "u1",
      requestedAt: at(`2026-11-01T0${i}:00:00Z`),
      bunzRequested: 10,
    }));
    expect(detectRedemptionSignals(rows).find((x) => x.type === "rapid_redemption")!.severity).toBe("high");
  });

  it("dispersion fuera de 24 h no dispara la regla rápida", () => {
    const rows = [
      { id: "a1", userHash: "u1", requestedAt: at("2026-11-01T00:00:00Z"), bunzRequested: 10 },
      { id: "a2", userHash: "u1", requestedAt: at("2026-11-02T00:00:00Z"), bunzRequested: 10 },
      { id: "a3", userHash: "u1", requestedAt: at("2026-11-03T00:00:00Z"), bunzRequested: 10 },
    ];
    expect(detectRedemptionSignals(rows).some((x) => x.type === "rapid_redemption")).toBe(false);
  });

  it("≥1000 Bunz en 24 h ⇒ redemption_burst", () => {
    const rows = [
      { id: "a1", userHash: "u2", requestedAt: at("2026-11-01T00:00:00Z"), bunzRequested: 600 },
      { id: "a2", userHash: "u2", requestedAt: at("2026-11-01T05:00:00Z"), bunzRequested: 600 },
    ];
    const s = detectRedemptionSignals(rows);
    expect(s.find((x) => x.type === "redemption_burst")!.detail.bunzRequested).toBeGreaterThanOrEqual(BURST_BUNZ);
  });

  it("3 pedidos con ≥30% pagado en Bunz en 7 días ⇒ discount_streak", () => {
    const rows = [0, 1, 2].map((i) => ({
      id: `o${i}`,
      customerId: "c1",
      createdAt: at(`2026-11-0${i + 1}T12:00:00Z`),
      total: 100,
      bunzPaid: 40,
    }));
    const s = detectDiscountStreak(rows);
    expect(s).toHaveLength(1);
    expect(s[0]!.type).toBe("discount_streak");
    expect(s[0]!.userHash).toHaveLength(32);
  });

  it("pedidos con poco Bunz no generan señal", () => {
    const rows = [0, 1, 2].map((i) => ({
      id: `o${i}`,
      customerId: "c1",
      createdAt: at(`2026-11-0${i + 1}T12:00:00Z`),
      total: 100,
      bunzPaid: 5,
    }));
    expect(detectDiscountStreak(rows)).toHaveLength(0);
  });

  it("con el flag apagado no lee ni escribe", async () => {
    const db = { select: () => ({ from: () => ({ where: async () => [] }) }), insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }) };
    const r = await runAbuseDetection(db as any, { tables: { attempts: {}, orders: {}, signals: {} } });
    expect(r).toMatchObject({ ok: true, detected: 0, inserted: 0 });
  });

  it("con el flag encendido persiste las señales detectadas", async () => {
    process.env[ABUSE_FLAG] = "true";
    const attempts = [0, 1, 2].map((i) => ({
      id: `a${i}`,
      userHash: "u1",
      requestedAt: at(`2026-11-01T0${i}:00:00Z`),
      bunzRequested: 10,
    }));
    const inserted: any[] = [];
    const db = {
      select: () => ({ from: (t: any) => ({ where: async () => (t === "attempts" ? attempts : []) }) }),
      insert: () => ({
        values: (v: any) => ({
          onConflictDoNothing: async () => {
            inserted.push(v);
          },
        }),
      }),
    };
    const r = await runAbuseDetection(db as any, {
      tables: { attempts: "attempts", orders: "orders", signals: "signals" },
      now: at("2026-11-02T00:00:00Z"),
    });
    expect(r.detected).toBe(1);
    expect(r.inserted).toBe(1);
    expect(inserted[0].type).toBe("rapid_redemption");
  });
});
