/**
 * ── trustRules ── Reglas puras de Rabbitter Trust & Engagement (F2, SHADOW).
 * Testeables sin DB — el router solo orquesta y ensambla insumos.
 *
 * Regla de oro §3: ningún componente mueve un peso ni algo operativo;
 * todo lo aquí calculado es diagnóstico interno con valor predictivo pendiente de validar.
 * Regla de oro §2: los antifraude del dinero solo marcan `REVIEW_FLAG` — jamás sancionan aquí.
 */

export const TRUST_LOOKBACK_DAYS = 90;
export const TRUST_METHOD = "trust_shadow_v1";

/** Muestras mínimas para que un componente sea confiable por sí solo. */
export const TRUST_MIN_PAYMENT_SAMPLE = 3;
export const TRUST_MIN_LEDGER_SAMPLE = 5;
export const TRUST_MIN_PRESENCE_SAMPLE = 1;

/** Pesos base (cada componente es interpretable por sí solo). */
export const TRUST_WEIGHTS = { payments: 0.55, ledger: 0.25, presence: 0.2 } as const;
/** Suma total = 1.0 */

/** Ratio SPEND/EARN por encima del cual sospecha alta de abuso (solo revisión). */
export const ABUSE_SPEND_EARN_RATIO = 2.5;
/** Earn acumulado nunca redimido que activa revisión: una cuenta que apila sin canjear. */
export const ABUSE_EARN_WITHOUT_SPEND_BUNZ = 200;

export type TrustConfidence = "LOW" | "MEDIUM" | "HIGH" | "NONE";

export interface TrustPaymentsInput {
  succeeded: number;
  failed: number;
  cancelled: number;
  expired: number;
}

export interface TrustTabsInput {
  /** Órdenes del sujeto canceladas por STALE_TAB (huérfanas). */
  stale: number;
  /** Órdenes del sujeto liquidadas normal (COMPLETED/PAID). */
  completed: number;
}

export interface TrustLedgerInput {
  /** Bunz ganados en la ventana (type=EARN, currency BUNZ). */
  earnBunz: number;
  /** Bunz redimidos en la ventana (type=SPEND, currency BUNZ). */
  spendBunz: number;
  /** Número de movimientos EARN+SPEND (muestra mínima real). */
  entryCount: number;
}

export interface TrustPresenceInput {
  sessionsBySource: { gps: number; scan: number; geofence: number; other: number };
}

export interface TrustComponent {
  /** null + reason en `insufficient` si no llegó a la muestra mínima. */
  score: number | null;
  sampleN: number;
  /** Notas de auditoría adicionales (ej. sospecha de abuso en ledger). */
  notes?: Record<string, unknown>;
}

export interface TrustShadowOptions {
  /** Rango de observación del score (90d por defecto; el filtro real lo hace el router). */
  lookbackDays?: number;
}

export interface TrustShadowResult {
  /** Puntaje 0–100; null cuando ningún componente alcanzó datos suficientes. */
  score: number | null;
  confidence: TrustConfidence;
  /** Total de insumos observados relevantes (pagos + canje/earn + sesiones + órdenes). */
  sampleN: number;
  components: {
    payments: TrustComponent;
    tabs: TrustComponent;
    ledger: TrustComponent;
    presence: TrustComponent;
  };
  /** Componentes excluidos por muestra insuficiente (transparencia de la muestra). */
  insufficient: string[];
  method: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Componente pagos: intent cerrados con SUCCEEDED vs total de intent cerrados. */
export function computePaymentsComponent(input: TrustPaymentsInput): TrustComponent {
  const closed = input.succeeded + input.failed + input.cancelled + input.expired;
  if (closed < TRUST_MIN_PAYMENT_SAMPLE) {
    return { score: null, sampleN: closed };
  }
  const pct = (input.succeeded / closed) * 100;
  return { score: round2(pct), sampleN: closed, notes: { succeeded: input.succeeded } };
}

/** Componente tabs: huérfanas STALE_TAB vs órdenes cerradas del sujeto. */
export function computeTabsComponent(input: TrustTabsInput): TrustComponent {
  const total = input.stale + input.completed;
  if (total < TRUST_MIN_PAYMENT_SAMPLE) {
    return { score: null, sampleN: total };
  }
  const staleShare = input.stale / total;
  return {
    score: round2((1 - staleShare) * 100),
    sampleN: total,
    notes: { staleTabs: input.stale },
  };
}

/**
 * Componente disciplina de canjes: sospecha si gasta mucho más de lo que
 * gana (ratio disparado) o si acumula mucho earn sin redimir. Score 0 +
 * `suspect` (solo revisión — nunca sanciona por sí sola).
 */
export function computeLedgerComponent(input: TrustLedgerInput): TrustComponent {
  if (input.entryCount < TRUST_MIN_LEDGER_SAMPLE) {
    return { score: null, sampleN: input.entryCount };
  }
  const ratio = input.earnBunz > 0 ? input.spendBunz / input.earnBunz : Infinity;
  const suspect = input.earnBunz === 0
    ? true // gasta sin generar Bunz nunca: sospecha directa
    : ratio > ABUSE_SPEND_EARN_RATIO
      || (input.spendBunz === 0 && input.earnBunz >= ABUSE_EARN_WITHOUT_SPEND_BUNZ);
  return {
    score: suspect ? 0 : 100,
    sampleN: input.entryCount,
    notes: {
      spendEarnRatio: Number.isFinite(ratio) ? round2(ratio) : null,
      suspect,
    },
  };
}

/** Componente presencia honesta: al menos 1 sesión con fuente conocida. */
export function computePresenceComponent(input: TrustPresenceInput): TrustComponent {
  const bySource = input.sessionsBySource;
  const total = (bySource.gps ?? 0) + (bySource.scan ?? 0) + (bySource.geofence ?? 0) + (bySource.other ?? 0);
  if (total < TRUST_MIN_PRESENCE_SAMPLE) {
    return { score: null, sampleN: total };
  }
  return { score: 100, sampleN: total, notes: { bySource } };
}

/**
 * Score consolidado: promedio ponderado con renormalización entre los
 * componentes confiables. Si nada es confiable → score null ("NONE").
 */
export function computeTrustShadow(input: {
  payments: TrustPaymentsInput;
  tabs: TrustTabsInput;
  ledger: TrustLedgerInput;
  presence: TrustPresenceInput;
}, opts: { now?: Date } = {}): TrustShadowResult {
  void opts; // reservado (lookback/snapshots futuros)

  const components = {
    payments: computePaymentsComponent(input.payments),
    tabs: computeTabsComponent(input.tabs),
    ledger: computeLedgerComponent(input.ledger),
    presence: computePresenceComponent(input.presence),
  } as const;

  const contributions: Array<["payments" | "ledger" | "presence", number]> = [];
  const insufficient: string[] = [];
  for (const key of ["payments", "ledger", "presence"] as const) {
    const score = components[key].score;
    if (score !== null && score !== undefined) {
      contributions.push([key, score]);
    } else {
      insufficient.push(key);
    }
  }
 /**
   * El componente tabs es diagnóstico independiente (no entra al score
   * consolidado — la huérfana puede ser fricción de producto, no del sujeto).
   */
  if (components.tabs.score === null) insufficient.push("tabs");

  let score: number | null = null;
  if (contributions.length > 0) {
    const totalWeight = contributions.reduce((acc, [k]) => acc + TRUST_WEIGHTS[k], 0);
    score = contributions.reduce((acc, [k, v]) => acc + TRUST_WEIGHTS[k] * v, 0) / totalWeight;
  }

  const closedPayments = components.payments.sampleN;
  const allSufficient = insufficient.length === 0;
  const confidence: TrustConfidence =
    score === null
      ? "NONE"
      : allSufficient && closedPayments >= 10
        ? "HIGH"
        : closedPayments >= TRUST_MIN_PAYMENT_SAMPLE && allSufficient
          ? "MEDIUM"
          : "LOW";

  const sampleN =
    components.payments.sampleN
    + (components.tabs.sampleN || 0)
    + components.ledger.sampleN
    + components.presence.sampleN;

  return {
    score: score === null ? null : round2(score),
    confidence,
    sampleN,
    components,
    insufficient,
    method: TRUST_METHOD,
  };
}
