/**
 * ── gratuityRules ── Gratificaciones VOLUNTARIAS (Rabbitty, session 2026-11-02).
 * Contrato de diseño (no-negociable):
 *  1. Catálogo fijo controlado por Rabbitty — el afiliado NO puede crear %.
 *  2. "No dejar gratificación" es una opción de primera clase, tan fácil como dejarla.
 *  3. Nada se preselecciona — la elección del comensal es EXPLÍCITA.
 *  4. La opción es independiente del medio de pago: mismas opciones en
 *     efectivo/tarjeta/QR/split. PROHIBIDO condicionar gratificación al método
 *     (el backend no acepta reglas por método y no hay campo que permita definirlas).
 *  5. Cap duro 15% (Gratuity max) — el backend rechaza montos fuera de catálogo.
 *  6. Va al pool de propinas del equipo (tipPayoutEnabled / corte Z) — misma
 *     conciliación que la infraestructura de propinas existente.
 */

/** Catálogo de porcentajes permitidos por Rabbitty (afiliado elige subconjunto). */
export const GRATUITY_ALLOWED_PCTS = [5, 10, 15] as const;
/** Cap duro server-side: gratificación ≤ 15% del consumo, sin excepciones. */
export const GRATUITY_MAX_PCT = 15;

export type GratuityMode = "OFF" | "POS" | "DIGITAL" | "BOTH";

export function parseGratuityPcts(raw: string | null | undefined): number[] {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => Number(v))
      .filter((n) => (GRATUITY_ALLOWED_PCTS as readonly number[]).includes(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Valida una gratificación elegida por el comensal (o digitada como "otro monto"
 * solo si Rabbitty lo habilita — fuera del alcance v1).
 * El canal NO es input: la regla es idéntica para cualquier método de pago.
 */
export function validateGratuity(
  gratuityAmount: number | null | undefined,
  total: number
): { ok: true; amount: number } | { ok: false; reason: "INVALID" | "EXCEEDS_MAX" | "NOT_POSITIVE" } {
  const amount = Number(gratuityAmount ?? 0);
  if (!Number.isFinite(amount)) return { ok: false, reason: "INVALID" };
  if (amount === 0) return { ok: true, amount: 0 };
  if (amount < 0) return { ok: false, reason: "NOT_POSITIVE" };
  if (!Number.isFinite(total) || total <= 0) return { ok: false, reason: "INVALID" };
  if (amount > round2(total * (GRATUITY_MAX_PCT / 100))) return { ok: false, reason: "EXCEEDS_MAX" };
  return { ok: true, amount: round2(amount) };
}
