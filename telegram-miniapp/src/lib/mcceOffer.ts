/**
 * MCCE · Oferta de capacidad para el onboarding.
 *
 * Misma lógica que `scripts/lib/mcce.mjs` (fuente de verdad del contrato).
 * No escribe nada: solo calcula opciones para que el afiliado elija cobertura.
 */

export const MCCE_OFFER_DEFAULTS = {
  coverageDays: [7, 14, 30],
  nicheFloor: 1000,
  nicheCeiling: 20000,
  solvencyCap: 10000,
  promoShare: 0.4,
  roundTo: 500,
  redemptionShare: 0.3,
};

const PRIORS: Record<string, number> = {
  restaurante: 0.35,
  restaurant: 0.35,
  cafetería: 0.35,
  cafeteria: 0.35,
  cafe: 0.35,
  bar: 0.35,
  barbershop: 0.3,
  "belleza y spa": 0.3,
  fitness: 0.25,
  gimnasio: 0.25,
  retail: 0.3,
  "tienda de ropa": 0.3,
  servicios: 0.25,
  "servicios de salud": 0.25,
  educación: 0.25,
  "servicios digitales": 0.2,
  otro: 0.3,
};

export function priorForNiche(value: string | null | undefined): number {
  if (!value) return MCCE_OFFER_DEFAULTS.redemptionShare;
  return PRIORS[String(value).trim().toLowerCase()] ?? MCCE_OFFER_DEFAULTS.redemptionShare;
}

export function estimateDailyDemand({
  dailyFiatSales = 0,
  rewardRate = 0.2,
  redemptionShare = MCCE_OFFER_DEFAULTS.redemptionShare,
}: {
  dailyFiatSales?: number;
  rewardRate?: number;
  redemptionShare?: number;
}): number {
  const sales = Math.max(0, Number(dailyFiatSales) || 0);
  const rate = Math.min(Math.max(Number(rewardRate) || 0, 0), 1);
  const share = Math.min(Math.max(Number(redemptionShare) || 0, 0), 1);
  return sales * rate * share;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(Number(v) || 0, min), max);
const roundTo = (v: number, step: number) => Math.round((Number(v) || 0) / step) * step;

export type CapacityOption = {
  tier: "BASIC" | "INTERMEDIATE" | "ADVANCED" | "CUSTOM";
  coverageDays: number;
  rawCapacity: number;
  totalCapacity: number;
  promoCapacity: number;
  creditCapacity: number;
};

export function buildCapacityOptions({
  dailyCapacityDemand = 0,
  nicheFloor = MCCE_OFFER_DEFAULTS.nicheFloor,
  nicheCeiling = MCCE_OFFER_DEFAULTS.nicheCeiling,
  solvencyCap = MCCE_OFFER_DEFAULTS.solvencyCap,
  coverageDays = MCCE_OFFER_DEFAULTS.coverageDays,
  promoShare = MCCE_OFFER_DEFAULTS.promoShare,
  step = MCCE_OFFER_DEFAULTS.roundTo,
}: {
  dailyCapacityDemand?: number;
  nicheFloor?: number;
  nicheCeiling?: number;
  solvencyCap?: number;
  coverageDays?: number[];
  promoShare?: number;
  step?: number;
} = {}): CapacityOption[] {
  const demand = Math.max(0, Number(dailyCapacityDemand) || 0);
  const ceiling = Math.min(
    Math.max(0, Number(nicheCeiling) || 0),
    Number.isFinite(solvencyCap) ? Math.max(0, Number(solvencyCap)) : Infinity
  );
  const tierByDays: Record<number, CapacityOption["tier"]> = {
    7: "BASIC",
    14: "INTERMEDIATE",
    30: "ADVANCED",
  };
  return coverageDays.map((days) => {
    const raw = demand * days;
    const total = roundTo(clamp(raw, Math.max(0, nicheFloor), ceiling), step);
    const promo = roundTo(total * clamp(promoShare, 0, 1), step);
    return {
      tier: tierByDays[days] ?? "CUSTOM",
      coverageDays: days,
      rawCapacity: Math.round(raw * 100) / 100,
      totalCapacity: total,
      promoCapacity: Math.min(promo, total),
      creditCapacity: Math.max(0, total - promo),
    };
  });
}

export function tierLabel(tier: CapacityOption["tier"]): string {
  if (tier === "BASIC") return "Básico";
  if (tier === "INTERMEDIATE") return "Intermedio";
  if (tier === "ADVANCED") return "Avanzado";
  return "Personalizado";
}
