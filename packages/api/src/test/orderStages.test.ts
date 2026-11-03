import { describe, expect, it } from "vitest";
import { deriveOrderStage, orderStageStepIndex, orderIsActive } from "@rabbitty/events";

/**
 * ── H-TRACK · stages de pedidos móviles ──
 * Derivación pura desde lo que YA existe en DB (orders.status + order_items
 * del KDS). No hay columnas nuevas — el contrato se prueba aquí.
 */
describe("orderStages — derivación de seguimiento", () => {
  it("PENDING + items pendientes → RECEIVED (acabas de pedir)", () => {
    expect(deriveOrderStage({ order: { status: "PENDING" }, items: [{ status: "PENDING" }, { status: "PENDING" }] }))
      .toBe("RECEIVED");
  });

  it("un item IN_PROGRESS → PREPARING (aunque el resto siga PENDING)", () => {
    expect(deriveOrderStage({ order: { status: "PENDING" }, items: [{ status: "PENDING" }, { status: "IN_PROGRESS" }] }))
      .toBe("PREPARING");
  });

  it("todos los items READY → READY (sin importar orders.status todavía PENDING)", () => {
    expect(deriveOrderStage({ order: { status: "PENDING" }, items: [{ status: "READY" }, { status: "SERVED" }] }))
      .toBe("READY");
  });

  it("COMPLETED → DONE (incluso si items quedaron raros); PAID sigue vivo", () => {
    expect(deriveOrderStage({ order: { status: "COMPLETED" }, items: [{ status: "PENDING" }] })).toBe("DONE");
    // Pagado ≠ entregado: el pedido sigue cocinándose y la tarjeta debe vivir.
    expect(deriveOrderStage({ order: { status: "PAID" }, items: [{ status: "PENDING" }] })).toBe("RECEIVED");
    expect(deriveOrderStage({ order: { status: "PAID" }, items: [{ status: "IN_PROGRESS" }] })).toBe("PREPARING");
    expect(deriveOrderStage({ order: { status: "PAID" }, items: [{ status: "READY" }] })).toBe("READY");
  });

  it("EXPIRED/CANCELLED/VOIDED → DONE (la tarjeta muere, no se comparte)", () => {
    for (const status of ["EXPIRED", "CANCELLED", "VOIDED"]) {
      expect(deriveOrderStage({ order: { status }, items: [{ status: "PENDING" }] })).toBe("DONE");
    }
  });

  it("CASH_PAYMENT_REQUESTED sin items movidos → PAYMENT_PENDING (listo por cobrar)", () => {
    expect(deriveOrderStage({ order: { status: "CASH_PAYMENT_REQUESTED" }, items: [{ status: "PENDING" }] }))
      .toBe("PAYMENT_PENDING");
    // pero si la cocina sigue moviéndose, PREPARING manda (cuentas de servicio)
    expect(deriveOrderStage({ order: { status: "CASH_PAYMENT_REQUESTED" }, items: [{ status: "IN_PROGRESS" }] }))
      .toBe("PREPARING");
  });

  it("PAYMENT_PENDING comparte el step de READY (el cobro es overlay, no cocina)", () => {
    expect(orderStageStepIndex("PAYMENT_PENDING")).toBe(orderStageStepIndex("READY"));
    expect(orderStageStepIndex("RECEIVED")).toBe(0);
    expect(orderStageStepIndex("DONE")).toBe(3);
  });

  it("activo: solo DONE quita la tarjeta", () => {
    expect(orderIsActive("RECEIVED")).toBe(true);
    expect(orderIsActive("PAYMENT_PENDING")).toBe(true);
    expect(orderIsActive("DONE")).toBe(false);
  });
});
