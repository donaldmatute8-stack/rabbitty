import { describe, expect, it } from "vitest";
import { computeBenefitPlan, type LoadedEntitlement } from "./membershipBenefits";

/**
 * La aritmética de beneficios es la única fuente para el cobro y para la vista
 * previa del POS, así que se prueba aquí sin base de datos.
 */

const ent = (over: Record<string, unknown> = {}) => ({
  id: "ent-1",
  subscriptionId: "sub-1",
  benefitType: "MEMBER_CONSUMPTION",
  targetRefId: null,
  quotaPerCycle: 2,
  currentUsageInCycle: 0,
  cycleResetType: "MONTHLY",
  cycleEndDate: new Date(Date.now() + 86_400_000),
  discountPct: null,
  creditBalance: null,
  ...over,
});

const loaded = (entRow: Record<string, unknown>): LoadedEntitlement[] => [
  { ent: ent(entRow), sub: { id: "sub-1" } },
];

const items = [
  { menuItemId: "cafe", quantity: 1, unitPrice: 55 },
  { menuItemId: "carajillo", quantity: 1, unitPrice: 185 },
];

describe("computeBenefitPlan", () => {
  it("el consumo del socio deja en cero solo sus artículos", () => {
    const plan = computeBenefitPlan({
      loaded: loaded({}),
      items,
      baseAmount: 240,
      memberMenuItemIds: ["carajillo"],
    });
    expect(plan.finalAmount).toBe(55);
    expect(plan.discount).toBe(185);
    expect(plan.lines[0].applied).toBe(185);
  });

  it("el producto incluido cubre una unidad, no la cantidad entera", () => {
    const plan = computeBenefitPlan({
      loaded: loaded({ benefitType: "INCLUDED_PRODUCT", targetRefId: "cafe" }),
      items: [{ menuItemId: "cafe", quantity: 2, unitPrice: 55 }],
      baseAmount: 110,
    });
    expect(plan.discount).toBe(55);
    expect(plan.finalAmount).toBe(55);
  });

  it("el porcentaje se calcula sobre lo que queda después del incluido", () => {
    const plan = computeBenefitPlan({
      loaded: [
        ...loaded({ id: "ent-inc", benefitType: "INCLUDED_PRODUCT", targetRefId: "cafe" }),
        ...loaded({ id: "ent-pct", benefitType: "DISCOUNT_PCT", discountPct: 10 }),
      ],
      items,
      baseAmount: 240,
    });
    // 240 − 55 (café) = 185 → 10 % = 18.5
    expect(plan.finalAmount).toBe(166.5);
    expect(plan.discount).toBe(73.5);
  });

  it("el saldo de crédito nunca cubre el 100%", () => {
    const plan = computeBenefitPlan({
      loaded: loaded({ benefitType: "CREDIT_BALANCE", creditBalance: 500, quotaPerCycle: null }),
      items,
      baseAmount: 240,
    });
    expect(plan.creditApplied).toBe(239.5);
    expect(plan.finalAmount).toBe(0.5);
  });

  it("marca agotado cuando la cuota del ciclo se consumió", () => {
    const plan = computeBenefitPlan({
      loaded: loaded({ currentUsageInCycle: 2 }),
      items,
      baseAmount: 240,
      memberMenuItemIds: ["carajillo"],
    });
    expect(plan.lines[0].exhausted).toBe(true);
    expect(plan.lines[0].applied).toBe(0);
    expect(plan.finalAmount).toBe(240);
  });

  it("ignora un beneficio ya aplicado a la misma orden", () => {
    const plan = computeBenefitPlan({
      loaded: loaded({}),
      items,
      baseAmount: 240,
      memberMenuItemIds: ["carajillo"],
      skipIds: new Set(["ent-1"]),
    });
    expect(plan.discount).toBe(0);
    expect(plan.finalAmount).toBe(240);
  });

  it("un plan que cubre todo deja finalAmount en 0 (cierre sin cobro)", () => {
    const plan = computeBenefitPlan({
      loaded: loaded({}),
      items,
      baseAmount: 240,
      memberMenuItemIds: ["cafe", "carajillo"],
    });
    expect(plan.finalAmount).toBe(0);
    expect(plan.discount).toBe(240);
  });
});
