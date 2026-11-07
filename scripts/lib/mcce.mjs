/**
 * ── MCCE · funciones puras ───────────────────────────────────────────────────
 *
 * Capacidad, incentivo, adelanto y recuperación. Sin DB, sin escrituras.
 * Estas funciones son la base de la simulación en sombra y de las pruebas.
 *
 * Regla de oro: la recuperación sale del excedente de capacidad NUEVA, nunca de
 * capacidad comprometida. El valor no se cuenta dos veces:
 *   generatedGross = generatedNet + retained
 */

export const MCCE_DEFAULTS = {
  coverageDaysOptions: [7, 14, 30],
  minCoverageDays: 7,
  retainShare: 0.2,
  triggerRatio: 3,
  triggerDays: 60,
  extraordinaryShare: 0.5,
  nicheFloor: 1000,
  nicheCeiling: 20000,
  promoShare: 0.4,
  roundTo: 500,
  redemptionShare: 0.35,
};

export const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

export function roundTo(value, step = 500) {
  const s = Number(step) || 1;
  return Math.round((Number(value) || 0) / s) * s;
}

/** Demanda diaria estimada de capacidad (Bunz/día). */
export function estimateDailyDemand({
  dailyFiatSales = 0,
  rewardRate = 0.2,
  redemptionShare = MCCE_DEFAULTS.redemptionShare,
} = {}) {
  const sales = Math.max(0, Number(dailyFiatSales) || 0);
  const rate = clamp(Number(rewardRate) || 0, 0, 1);
  const share = clamp(Number(redemptionShare) || 0, 0, 1);
  return sales * rate * share;
}

/** Días de cobertura de una capacidad dada. */
export function coverageDaysOf({ capacityAvailable = 0, dailyRedemption = 0 } = {}) {
  const daily = Math.max(0, Number(dailyRedemption) || 0);
  if (daily <= 0) return null;
  return Math.max(0, Number(capacityAvailable) || 0) / daily;
}

const TIER_BY_DAYS = { 7: "BASIC", 14: "INTERMEDIATE", 30: "ADVANCED" };

/**
 * Genera las opciones reales que el motor puede autorizar.
 * El afiliado elige entre ellas; no inventa montos.
 */
export function buildCapacityOptions({
  dailyCapacityDemand = 0,
  nicheFloor = MCCE_DEFAULTS.nicheFloor,
  nicheCeiling = MCCE_DEFAULTS.nicheCeiling,
  solvencyCap = Infinity,
  coverageDays = MCCE_DEFAULTS.coverageDaysOptions,
  promoShare = MCCE_DEFAULTS.promoShare,
  roundTo: step = MCCE_DEFAULTS.roundTo,
} = {}) {
  const demand = Math.max(0, Number(dailyCapacityDemand) || 0);
  const ceiling = Math.min(
    Math.max(0, Number(nicheCeiling) || 0),
    Number.isFinite(solvencyCap) ? Math.max(0, Number(solvencyCap)) : Infinity
  );
  return coverageDays.map((days) => {
    const raw = demand * days;
    const total = roundTo(clamp(raw, Math.max(0, nicheFloor), ceiling), step);
    const promo = roundTo(total * clamp(promoShare, 0, 1), step);
    return {
      tier: TIER_BY_DAYS[days] ?? "CUSTOM",
      coverageDays: days,
      rawCapacity: round2(raw),
      totalCapacity: total,
      promoCapacity: Math.min(promo, total),
      creditCapacity: Math.max(0, total - promo),
    };
  });
}

/**
 * Recuperación por retención de capacidad generada (Modelo A).
 *
 * `generatedGross` es capacidad NUEVA del evento.
 * `coverageNeed` es la capacidad que debe quedar libre para cobertura.
 * `baseAvailable` es la capacidad disponible antes del evento (ya descuenta
 * comprometidos y reserva).
 *
 * El excedente recuperable es lo que supera la cobertura mínima. La retención
 * nunca toca capacidad comprometida.
 */
export function recoverFromGeneratedCapacity({
  generatedGross = 0,
  coverageNeed = 0,
  creditOutstanding = 0,
  baseAvailable = 0,
  retainShare = MCCE_DEFAULTS.retainShare,
} = {}) {
  const gross = Math.max(0, Number(generatedGross) || 0);
  const need = Math.max(0, Number(coverageNeed) || 0);
  const outstanding = Math.max(0, Number(creditOutstanding) || 0);
  const share = clamp(retainShare, 0, 1);

  // La cobertura se protege con la capacidad que YA existe. Solo la parte
  // faltante se descuenta de la capacidad nueva.
  const shortfall = Math.max(0, need - Math.max(0, Number(baseAvailable) || 0));
  const surplus = Math.max(0, gross - shortfall);
  const retained = Math.min(surplus, outstanding, gross * share);
  const generatedNet = gross - retained;
  const newCreditOutstanding = Math.max(0, outstanding - retained);
  const newAvailable = Math.max(0, Number(baseAvailable) + generatedNet);

  return {
    generatedGross: gross,
    coverageNeed: need,
    coverageShortfall: round2(shortfall),
    surplus: round2(surplus),
    retained: round2(retained),
    generatedNet: round2(generatedNet),
    newCreditOutstanding: round2(newCreditOutstanding),
    newAvailable: round2(newAvailable),
    coverageBlocked: surplus <= 0,
    // Conservación del valor:
    valueConserved: Math.abs(gross - (generatedNet + retained)) < 0.01,
  };
}

/** ¿Se cumple el acelerador de recuperación? */
export function shouldAccelerate({
  generatedNet = 0,
  creditOutstanding = 0,
  coverageDays = null,
  triggerRatio = MCCE_DEFAULTS.triggerRatio,
  triggerDays = MCCE_DEFAULTS.triggerDays,
  daysAtTrigger = 0,
  minCoverageDays = MCCE_DEFAULTS.minCoverageDays,
} = {}) {
  const reasons = [];
  if (!(Number(creditOutstanding) > 0)) reasons.push("sin compromiso pendiente");
  if (Number(generatedNet) < Number(triggerRatio) * Number(creditOutstanding)) {
    reasons.push(`capacidad generada < ${triggerRatio}× el compromiso`);
  }
  if (coverageDays === null || Number(coverageDays) < Number(minCoverageDays)) {
    reasons.push(`cobertura < ${minCoverageDays} días`);
  }
  if (Number(daysAtTrigger) < Number(triggerDays)) {
    reasons.push(`ventana < ${triggerDays} días`);
  }
  return { accelerate: reasons.length === 0, reasons };
}

/** Retención extraordinaria sobre el excedente (nunca sobre comprometido). */
export function extraordinaryRetention({
  generatedGross = 0,
  coverageNeed = 0,
  baseAvailable = 0,
  creditOutstanding = 0,
  extraordinaryShare = MCCE_DEFAULTS.extraordinaryShare,
} = {}) {
  const gross = Math.max(0, Number(generatedGross) || 0);
  const shortfall = Math.max(
    0,
    Math.max(0, Number(coverageNeed) || 0) - Math.max(0, Number(baseAvailable) || 0)
  );
  const surplus = Math.max(0, gross - shortfall);
  const retained = Math.min(
    surplus,
    Math.max(0, Number(creditOutstanding) || 0),
    gross * clamp(extraordinaryShare, 0, 1)
  );
  return {
    surplus: round2(surplus),
    retained: round2(retained),
    generatedNet: round2(gross - retained),
    newCreditOutstanding: round2(Math.max(0, Number(creditOutstanding) - retained)),
  };
}

/**
 * Invariantes de una cuenta de capacidad. Devuelve errores legibles.
 */
export function validateCapacityAccount(account = {}) {
  const errors = [];
  const n = (v) => Number(v) || 0;

  if (n(account.creditRepaid) > n(account.creditDisbursed) + 0.01) {
    errors.push("recuperación mayor que capacidad adelantada");
  }
  if (Math.abs(n(account.creditOutstanding) - (n(account.creditDisbursed) - n(account.creditRepaid))) > 0.01) {
    errors.push("compromiso pendiente no cuadra con adelantado − recuperado");
  }
  if (n(account.capacityCommitted) > n(account.effectiveLimit) + 0.01) {
    errors.push("capacidad comprometida mayor que el límite efectivo (exceso heredado)");
  }
  if (n(account.capacityAvailable) < -0.01) {
    errors.push("capacidad disponible negativa");
  }
  if (n(account.capacityGeneratedGross) + 0.01 < n(account.capacityGeneratedNet)) {
    errors.push("capacidad generada neta mayor que la bruta");
  }
  if (
    Math.abs(
      n(account.capacityAvailable) -
        Math.max(0, n(account.effectiveLimit) - n(account.capacityCommitted) - n(account.coverageReserve))
    ) > 0.01
  ) {
    errors.push("capacidad disponible no sigue el límite efectivo − comprometido − reserva");
  }
  return errors;
}

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}
