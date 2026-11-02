/**
 * ── ratingRules ── Reglas puras de Rabbitty Score F1 (testeables sin DB).
 * Cualquier cambio de política vive aquí; el router solo orquesta.
 */

export const RATING_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_MIN_SAMPLE = 5;
export const PRIOR_MEAN = 3.0;
export const PRIOR_WEIGHT = 4;
export const RECENCY_HALF_LIFE_DAYS = 90;
/** Umbral de la regla de duplicado EXACTO (único autocontrol permitido). */
export const DUPLICATE_EXACT_THRESHOLD = 3;
export const DUPLICATE_WINDOW_HOURS = 72;

export type RatingEligibilityReason =
  | "NOT_FOUND"
  | "NOT_YOURS"
  | "NOT_PAID"
  | "NO_PAYMENT"
  | null;

/** ¿La orden puede generar una oportunidad de evaluación? (ambos canales) */
export function isOrderEligibleForRating(input: {
  orderStatus: string | null | undefined;
  hasCompletedPayment: boolean;
}): { eligible: boolean; reason: RatingEligibilityReason } {
  const paid = input.orderStatus === "COMPLETED" || input.orderStatus === "PAID";
  if (!paid) return { eligible: false, reason: "NOT_PAID" };
  if (!input.hasCompletedPayment) return { eligible: false, reason: "NO_PAYMENT" };
  return { eligible: true, reason: null };
}

/** ¿Sigue abierta la ventana de edición del autor? */
export function canEditRating(createdAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const ts = new Date(createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return now.getTime() - ts <= RATING_EDIT_WINDOW_MS;
}

/**
 * Estado de moderación al enviar/editar. Única regla de ocultamiento
 * automático: duplicado EXACTO verificable (mismo texto, mismo usuario,
 * mismo comercio, ventana 72h). Todo lo demás → VISIBLE.
 * La correlación multi-cuenta NO entra aquí (solo marca reviewFlag manual).
 */
export function resolveModerationStatus(priorIdenticalComments: number): "VISIBLE" | "PENDING_REVIEW" {
  return priorIdenticalComments >= DUPLICATE_EXACT_THRESHOLD ? "PENDING_REVIEW" : "VISIBLE";
}

export interface ShadowScoreEntry {
  stars: number;
  createdAt: Date | string | null | undefined;
}

export interface ShadowScoreOptions {
  now?: Date;
  priorMean?: number;
  priorWeight?: number;
  halfLifeDays?: number;
}

/**
 * Merchant Service Score (SHADOW): media con recencia (decaimiento exponencial)
 * + shrinkage bayesiano hacia el prior. Determinista y sin efectos externos.
 */
export function computeShadowScore(
  entries: ShadowScoreEntry[],
  opts: ShadowScoreOptions = {}
): {
  score: number;
  sampleN: number;
  components: { recencyMean: number; priorMean: number; priorWeight: number; recencyHalfLifeDays: number; method: string };
} {
  const now = opts.now ?? new Date();
  const priorMean = opts.priorMean ?? PRIOR_MEAN;
  const priorWeight = opts.priorWeight ?? PRIOR_WEIGHT;
  const halfLifeDays = opts.halfLifeDays ?? RECENCY_HALF_LIFE_DAYS;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const e of entries) {
    const ageDays = Math.max(0, (now.getTime() - new Date(e.createdAt ?? now).getTime()) / 86400000);
    const w = Math.pow(0.5, ageDays / halfLifeDays);
    weightedSum += Number(e.stars) * w;
    weightTotal += w;
  }
  const recencyMean = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const n = entries.length;
  const score = n > 0 ? (recencyMean * n + priorMean * priorWeight) / (n + priorWeight) : priorMean;

  return {
    score: Math.round(score * 100) / 100,
    sampleN: n,
    components: {
      recencyMean: Math.round(recencyMean * 100) / 100,
      priorMean,
      priorWeight,
      recencyHalfLifeDays: halfLifeDays,
      method: "bayesian_shrinkage_with_recency",
    },
  };
}

/** Cobertura de opiniones (contexto de muestra — NO satisfacción). */
export function computeCoverage(rated: number, eligible: number): { rated: number; eligible: number; pct: number } {
  const pct = eligible > 0 ? Math.round((rated / eligible) * 100) : 0;
  return { rated, eligible, pct };
}