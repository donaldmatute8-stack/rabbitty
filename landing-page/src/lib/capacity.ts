/**
 * ── Capacidad dinámica ───────────────────────────────────────────────────────
 *
 * La capacidad no es un paquete fijo. Se estima con la operación del negocio:
 *
 *   capacidad = ventas mensuales elegibles × % de recompensa × meses de cobertura
 *
 * Es una estimación referencial para el alta. No autoriza capacidad, no cobra
 * nada y no activa saldos. La autorización real se hace después, con oferta
 * individual y aceptación del afiliado.
 */

export const CAPACITY_MIN = 1_000;
export const CAPACITY_MAX = 200_000;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function roundCapacity(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 5_000) return Math.round(value / 500) * 500;
  if (value < 20_000) return Math.round(value / 1_000) * 1_000;
  return Math.round(value / 5_000) * 5_000;
}

export function estimateCapacity({
  monthlySales,
  rewardPct,
  months,
}: {
  monthlySales: number;
  rewardPct: number;
  months: number;
}): number {
  const sales = clamp(Number(monthlySales) || 0, 0, 5_000_000);
  const pct = clamp(Number(rewardPct) || 10, 10, 50);
  const coverage = clamp(Number(months) || 1, 0.5, 3);
  return clamp(roundCapacity(sales * (pct / 100) * coverage), CAPACITY_MIN, CAPACITY_MAX);
}

export type CapacityScenario = {
  id: "base" | "recommended" | "wide";
  label: string;
  months: number;
  capacity: number;
  description: string;
  badge?: string;
};

export function capacityScenarios(monthlySales: number, rewardPct: number): CapacityScenario[] {
  return [
    {
      id: "base",
      label: "Arranque",
      months: 1,
      capacity: estimateCapacity({ monthlySales, rewardPct, months: 1 }),
      description: "Una cobertura inicial para empezar sin sobreexponerte.",
    },
    {
      id: "recommended",
      label: "Recomendado",
      months: 2,
      capacity: estimateCapacity({ monthlySales, rewardPct, months: 2 }),
      description: "Equilibra capacidad para recibir Rabbitters y margen de operación.",
      badge: "Sugerido",
    },
    {
      id: "wide",
      label: "Cobertura amplia",
      months: 3,
      capacity: estimateCapacity({ monthlySales, rewardPct, months: 3 }),
      description: "Más capacidad para campañas, eventos o temporadas altas.",
    },
  ];
}

export function formatBunz(value: number): string {
  return Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}
