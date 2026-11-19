import { describe, it, expect } from "vitest";
import {
  computePlatformCommission,
  describeCommission,
  type PlatformCommissionConfig,
} from "../services/platformCommission";

/**
 * Comisión de plataforma: es dinero. Estas pruebas fijan las reglas acordadas:
 * - Bunz nunca paga comisión.
 * - Sólo pedidos de la app (por defecto).
 * - Apagada = 0.
 * - El mínimo nunca supera el monto de la venta.
 */
const cfg = (over: Partial<PlatformCommissionConfig> = {}): PlatformCommissionConfig => ({
  enabled: true,
  pct: 0.038,
  appliesTo: "APP_ORDERS",
  minFeeMxn: 0,
  ...over,
});

describe("computePlatformCommission", () => {
  it("apagada no cobra nada", () => {
    const r = computePlatformCommission({ grossCents: 28000, fromApp: true, config: cfg({ enabled: false }) });
    expect(r.cents).toBe(0);
    expect(r.reason).toBe("disabled");
  });

  it("cobra 3.8% sobre un pedido de la app", () => {
    const r = computePlatformCommission({ grossCents: 28000, fromApp: true, config: cfg() });
    expect(r.baseCents).toBe(28000);
    expect(r.pct).toBe(0.038);
    expect(r.cents).toBe(1064); // 280 × 0.038
  });

  it("la venta de mostrador no paga con APP_ORDERS", () => {
    const r = computePlatformCommission({ grossCents: 28000, fromApp: false, config: cfg() });
    expect(r.cents).toBe(0);
    expect(r.reason).toBe("not_app_order");
  });

  it("con appliesTo ALL la venta de mostrador sí paga", () => {
    const r = computePlatformCommission({
      grossCents: 28000,
      fromApp: false,
      config: cfg({ appliesTo: "ALL" }),
    });
    expect(r.cents).toBe(1064);
  });

  it("Bunz nunca paga comisión: base = total − bunz", () => {
    const r = computePlatformCommission({
      grossCents: 28000,
      bunzCents: 11200, // 40 %
      fromApp: true,
      config: cfg(),
    });
    expect(r.baseCents).toBe(16800);
    expect(r.cents).toBe(638); // 168 × 0.038
  });

  it("un pedido 100% Bunz no genera comisión", () => {
    const r = computePlatformCommission({
      grossCents: 28000,
      bunzCents: 28000,
      fromApp: true,
      config: cfg(),
    });
    expect(r.cents).toBe(0);
    expect(r.reason).toBe("bunz_only");
  });

  it("el mínimo nunca supera el monto de la venta", () => {
    const r = computePlatformCommission({
      grossCents: 500, // $5
      fromApp: true,
      config: cfg({ minFeeMxn: 10 }), // mínimo $10
    });
    expect(r.cents).toBe(500);
  });

  it("el mínimo sí aplica cuando es menor que la base", () => {
    const r = computePlatformCommission({
      grossCents: 100000, // $1,000
      fromApp: true,
      config: cfg({ minFeeMxn: 10 }),
    });
    expect(r.cents).toBe(3800); // 3.8 % > $10
  });

  it("describeCommission explica los casos sin cobro", () => {
    const bunz = computePlatformCommission({
      grossCents: 10000,
      bunzCents: 10000,
      fromApp: true,
      config: cfg(),
    });
    expect(describeCommission(bunz)).toMatch(/100 % Bunz/);
    const counter = computePlatformCommission({ grossCents: 10000, fromApp: false, config: cfg() });
    expect(describeCommission(counter)).toMatch(/mostrador/);
  });
});
