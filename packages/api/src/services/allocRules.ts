/**
 * ── allocRules ── Growth Allocation en SHADOW (F3, code only — NUNCA operativo).
 * Docs/RABBITTY-SCORE-PLAN.md §3 F3 + decisiones D-5/D-6.
 *
 * Qué hace: puntúa campañas activas del ecosistema y propone acciones de
 * presupuesto/servicio para el God Admin. Nada aquí asigna dinero ni cambia
 * visibilidad: es PROPUESTA con explicabilidad (reasons), siempre con
 * aprobación humana (Regla de oro §3) y gateada por Bx2 cuando Bunzy llegue.
 * En el futuro se calibra con data real (F2-8 / 30-90d).
 */

import { PUBLIC_MIN_SAMPLE } from "./ratingRules";

export const GROWTH_ALLOC_METHOD = "growth_alloc_shadow_v1";
/** Utilización del presupuesto saludable de referencia. */
export const ALLOC_TARGET_UTILIZATION = 0.6;
/** Redenciones/mes que consideramos momentum pleno. */
export const ALLOC_FULL_MOMENTUM_REDEMPTIONS = 10;
/** Días activos sin redenciones para proponer pausa. */
export const ALLOC_PAUSE_AFTER_DAYS = 14;

export const ALLOC_WEIGHTS = { merchantService: 0.4, campaignEfficiency: 0.35, campaignMomentum: 0.25 } as const; // Σ 1.0

export type AllocRecommendation =
  | "REFILL_REQUEST"     // budget agotado y funcionando
  | "BOOST"              // score+momentum sanos: candidato a más presupuesto
  | "OPTIMIZE"           // funciona, matiz para mejorar
  | "NURTURE_SERVICE"    // el problema es la calidad del servicio (F1)
  | "PAUSE_CANDIDATE"    // sin tracción sostenida: revisar antes de gastar más
  | "KEEP";

export interface AllocComponent { score: number | null; notes?: Record<string, unknown>; }

export interface AllocShadowInput {
  /** Merchant Service Score shadow (0–5, bayesiano F1). null si sin muestra. */
  merchantShadowScore: number | null;
  /** Muestra de ratings (n) del merchant — fuente de confianza del comp. */
  serviceSampleN: number;
  /** budgetSpent / budgetBunz (0–1). 0 si sin presupuesto. */
  utilization: number;
  /** Redenciones de los últimos 30 días. */
  redemptions30d: number;
  /** budgetBunz − budgetSpent. */
  budgetRemainingBunz: number;
  /** Días desde el arranque de la campaña. */
  campaignAgeDays: number;
}

export interface AllocShadowResult {
  score: number | null;
  confidence: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  recommendation: AllocRecommendation;
  /** Motivos explicables — texto humano para el God Admin. */
  reasons: string[];
  /** Componentes excluidos por muestra insuficiente. */
  insufficient: string[];
  method: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Utilization → 0–100 conservador: 0 rellenado? se quiere uso, no quema por quemar. */
function efficiencyScore(utilization: number): number {
  return clamp((utilization / ALLOC_TARGET_UTILIZATION) * 100, 0, 100);
}

function momentumScore(redemptions30d: number): number {
  return clamp((redemptions30d / ALLOC_FULL_MOMENTUM_REDEMPTIONS) * 100, 0, 100);
}

function serviceScore(shadow5: number): number {
  // prior bayesiano 3.0 (F1) → 50/100; escala de estrellas 1–5 → 0–100
  return clamp(((shadow5 - 1) / 4) * 100, 0, 100);
}

/**
 * Puntúa y recomienda. Determinista, sin efectos externos.
 * La recomendación "carga" de la data (reasons) — siempre revisable por humano.
 */
export function computeAllocationShadow(input: AllocShadowInput): AllocShadowResult {
  const reasons: string[] = [];
  const insufficient: string[] = [];

  // Componente servicio (usa el score bayesiano de F1; insuficiente sin n≥5)
  const hasService = input.merchantShadowScore !== null && input.serviceSampleN >= PUBLIC_MIN_SAMPLE;
  if (!hasService) insufficient.push("merchantService");
  const service = hasService ? serviceScore(input.merchantShadowScore as number) : null;

  const efficiency = efficiencyScore(input.utilization);
  const momentum = momentumScore(input.redemptions30d);  if (input.utilization === 0) insufficient.push("campaignEfficiency");
  if (input.redemptions30d === 0) insufficient.push("campaignMomentum");

  const comps = [
    ["merchantService", service, ALLOC_WEIGHTS.merchantService],
    ["campaignEfficiency", input.utilization > 0 ? efficiency : null, ALLOC_WEIGHTS.campaignEfficiency],
    ["campaignMomentum", input.redemptions30d > 0 ? momentum : null, ALLOC_WEIGHTS.campaignMomentum],
  ] as const;

  const active = comps.filter(([, s]) => s !== null) as Array<[string, number, number]>;
  let score: number | null = null;
  if (active.length > 0) {
    const totalW = active.reduce((a, [, , w]) => a + w, 0);
    score = active.reduce((a, [, s, w]) => a + s * w, 0) / totalW;
  }

  // ── Recomendación (precedencia: urgencias primero) ──
  const budgetExhausted = input.budgetRemainingBunz <= 0;
  const noTraccion = input.redemptions30d === 0 && input.campaignAgeDays >= ALLOC_PAUSE_AFTER_DAYS;

  let recommendation: AllocRecommendation;
  if (noTraccion) {
    recommendation = "PAUSE_CANDIDATE";
    reasons.push(`Sin redenciones en 30 días con ${input.campaignAgeDays} días de vida — revisar targeting/incentivo antes de gastar más.`);
  } else if (budgetExhausted) {
    recommendation = "REFILL_REQUEST";
    reasons.push("Presupuesto agotado con demanda registrada — candidato a refill si el score lo respalda.");
  } else if (hasService && service !== null && service < 40) {
    recommendation = "NURTURE_SERVICE";
    reasons.push(`Score de servicio bajo (${round2(input.merchantShadowScore ?? 0)}/5, n=${input.serviceSampleN}) — dinero extra no arregla la experiencia; mejorar servicio primero (F1).`);
  } else if (score !== null && score >= 75 && momentum >= 50 && input.utilization < 0.9) {
    recommendation = "BOOST";
    reasons.push("Score alto con momentum sano — candidato a reforzar presupuesto (con autorización D-6).");
  } else if (score !== null && score >= 45) {
    recommendation = "OPTIMIZE";
    reasons.push("Score intermedio — mantener y afinar incentivo/targeting.");
  } else {
    recommendation = "KEEP";
    if (score === null) reasons.push("Sin datos suficientes para puntuar (campaña nueva o sin actividad) — mantener status quo.");
  }

  if (!hasService && score !== null) reasons.push(`Sin score de servicio confiable (n<${PUBLIC_MIN_SAMPLE}) — peso renormalizado entre los demás componentes.`);
  if (input.redemptions30d === 0) reasons.push("Redenciones 30d en 0 — momentum excluido del score.");

  const confidence: AllocShadowResult["confidence"] =
    score === null ? "NONE" : insufficient.length === 0 && input.redemptions30d >= 5 ? "HIGH" : insufficient.length === 0 ? "MEDIUM" : "LOW";

  return {
    score: score === null ? null : round2(score),
    confidence,
    recommendation,
    reasons,
    insufficient,
    method: GROWTH_ALLOC_METHOD,
  };
}
