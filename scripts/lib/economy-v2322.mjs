/**
 * ── Bunz Economy v2.3.2.2 — librería pura de validación ─────────────────────
 * Sin DB, sin producción. Solo funciones testables.
 *
 * Cambios frente a v2.3.2.1 (auditoría del 2026-11-06):
 *  1. `settleObligations()` es el ÚNICO camino de pago: siempre sobre el
 *     conjunto completo de obligaciones pagables, nunca sobre una recién creada.
 *  2. Semántica temporal explícita: la obligación vence al FINAL de `dueMonth`
 *     (+ `graceMonths`). `isDue`, `overdueMonths`, `isOverdue`, `isLongOverdue`.
 *  3. `splitAuthorization()` separa compromiso histórico protegido (`hardLimit`,
 *     `committed`) del techo recalculable (`currentCeiling`, puede bajar).
 *  4. `concentrationOf()` mide top1/top3/HHI/categoría sobre la capacidad REAL
 *     (no sobre la asignación preliminar), y los caps lo usan como única fuente.
 *  5. `applyConcentrationCaps()` devuelve `reason` en TODOS los casos no factibles.
 */

export const sum = (xs) => xs.reduce((a, x) => a + x, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Redistribución
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mobility: 0 = nula, 0.5 = parcial, 1 = perfecta.
 * Separa demanda local, demanda que sale, capacidad que recibe y unmet final.
 */
export function redistribute({ requested, capacity, mobility = 1 }) {
  const n = requested.length;
  const servedLocal = requested.map((r, i) => Math.min(r, capacity[i]));
  const unmetLocal = requested.map((r, i) => r - servedLocal[i]);
  const spare = capacity.map((c, i) => Math.max(0, c - servedLocal[i]));

  const totalUnmet = sum(unmetLocal);
  const totalSpare = sum(spare);
  const movable = Math.min(totalUnmet * Math.max(0, Math.min(1, mobility)), totalSpare);

  const movedFrom = unmetLocal.map((u) => (totalUnmet > 0 ? (movable * u) / totalUnmet : 0));
  const movedTo = spare.map((sp) => (totalSpare > 0 ? (movable * sp) / totalSpare : 0));

  const served = servedLocal.map((s, i) => s + movedTo[i]);
  const unmetEcosystem = unmetLocal.map((u, i) => Math.max(0, u - movedFrom[i]));

  return {
    servedLocal,
    reassignedFrom: movedFrom,
    reassignedTo: movedTo,
    reassigned: movedTo, // compatibilidad
    served,
    unmetLocal,
    unmetEcosystem,
    totalRequested: sum(requested),
    totalServedLocal: sum(servedLocal),
    totalReassigned: movable,
    totalServed: sum(served),
    totalUnmetLocal: totalUnmet,
    totalUnmetEcosystem: sum(unmetEcosystem),
    notMoved: totalUnmet - movable,
    totalSpare,
  };
}

export function redistributeInvariants(result, requested, capacity) {
  const eps = 0.01;
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok });
  add("local<=requested", result.servedLocal.every((s, i) => s <= requested[i] + eps));
  add("served<=capacity", result.served.every((s, i) => s <= capacity[i] + eps));
  add("global-served<=requested", result.totalServed <= result.totalRequested + eps);
  add("local+movedTo=served", Math.abs(result.totalServedLocal + result.totalReassigned - result.totalServed) < eps);
  add("movedFrom=movedTo", Math.abs(sum(result.reassignedFrom) - sum(result.reassignedTo)) < eps);
  add("unmet>=0", result.unmetEcosystem.every((u) => u >= -eps));
  add("unmet=requested-served", Math.abs(result.totalUnmetEcosystem - (result.totalRequested - result.totalServed)) < eps);
  return { ok: checks.every((c) => c.ok), checks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semántica temporal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decisión explícita de vencimiento (punto P1 de la auditoría):
 *
 *  - `dueMonth = m` significa "vence al final del mes m".
 *  - La obligación es COBRABLE desde el inicio de `dueMonth` (isDue).
 *  - Está VENCIDA (overdue) cuando ha transcurrido al menos un mes completo
 *    después de `dueMonth + graceMonths`. Es decir: `month >= dueMonth + grace + 1`.
 *  - Está VENCIDA HACE MÁS DE `longOverdueMonths` cuando
 *    `month >= dueMonth + grace + longOverdueMonths`.
 *
 * Con `graceMonths = 0`: en el mes de vencimiento NO bloquea, bloquea al mes
 * siguiente. Esto unifica especificación y código (antes el código bloqueaba
 * el mismo mes del vencimiento).
 */
export const DUE = {
  dueAtEndOfMonth: true,
  graceMonths: 0,
  longOverdueMonths: 2,
};

export function isDue(o, month) {
  return month >= o.dueMonth;
}

export function overdueMonths(o, month) {
  const grace = o.graceMonths ?? DUE.graceMonths;
  return Math.max(0, month - o.dueMonth - grace);
}

export function isOverdue(o, month) {
  return overdueMonths(o, month) >= 1;
}

export function isLongOverdue(o, month, threshold = DUE.longOverdueMonths) {
  return overdueMonths(o, month) >= threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obligaciones
// ─────────────────────────────────────────────────────────────────────────────

export const OBLIGATION_STATE = {
  OPEN: "OPEN",
  DISPUTED: "DISPUTED",
  RESOLVED_PAYABLE: "RESOLVED_PAYABLE",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  RESOLVED_NOT_PAYABLE: "RESOLVED_NOT_PAYABLE",
};

export function createObligation({ id, amount, month, dueMonth, disputed = false, graceMonths = DUE.graceMonths }) {
  return {
    id,
    amount,
    outstanding: amount,
    createdMonth: month,
    dueMonth,
    graceMonths,
    state: disputed ? OBLIGATION_STATE.DISPUTED : OBLIGATION_STATE.OPEN,
    resolvedAt: null,
    writtenOff: 0,
    settled: 0,
    settlements: [],
  };
}

export function resolveDispute(obligation, month, payable) {
  if (obligation.state !== OBLIGATION_STATE.DISPUTED) return false;
  obligation.state = payable ? OBLIGATION_STATE.RESOLVED_PAYABLE : OBLIGATION_STATE.RESOLVED_NOT_PAYABLE;
  obligation.resolvedAt = month;
  if (!payable) {
    // El castigo extingue el saldo: una obligación no pagable NO puede seguir
    // contando como deuda ni bloquear al afiliado para siempre.
    obligation.writtenOff = obligation.outstanding;
    obligation.outstanding = 0;
    obligation.state = OBLIGATION_STATE.RESOLVED_NOT_PAYABLE;
  }
  return true;
}

export function isPayable(obligation) {
  return (
    obligation.state === OBLIGATION_STATE.OPEN ||
    obligation.state === OBLIGATION_STATE.RESOLVED_PAYABLE ||
    (obligation.state === OBLIGATION_STATE.PARTIALLY_PAID && obligation.outstanding > 0)
  );
}

/**
 * Vistas de deuda. `scope`:
 *  - "all"          → todo lo pendiente (incluye disputas si se pide)
 *  - "settleable"   → sólo lo pagable ahora
 *  - "overdue"      → vencido (≥ 1 mes después de due+grace); NO incluye disputas
 *  - "longOverdue"  → vencido hace ≥ longOverdueMonths
 *  - "disputed"     → sólo disputas
 */
export function outstandingOf(
  obligations,
  { month = Infinity, scope = "all", includeDisputed = false, longOverdueMonths = DUE.longOverdueMonths } = {}
) {
  return obligations.reduce((acc, o) => {
    if (o.outstanding <= 0) return acc;
    if (o.state === OBLIGATION_STATE.PAID || o.state === OBLIGATION_STATE.RESOLVED_NOT_PAYABLE) return acc;

    const disputed = o.state === OBLIGATION_STATE.DISPUTED;
    if (scope === "disputed") return disputed ? acc + o.outstanding : acc;
    if (disputed && !includeDisputed) return acc;

    if (scope === "settleable" && !isPayable(o)) return acc;
    if (scope === "overdue" && !isOverdue(o, month)) return acc;
    if (scope === "longOverdue" && !isLongOverdue(o, month, longOverdueMonths)) return acc;
    return acc + o.outstanding;
  }, 0);
}

/**
 * ÚNICO camino de pago. Recibe SIEMPRE el conjunto completo de obligaciones del
 * afiliado. Paga por antigüedad (dueMonth, luego id) y admite pago parcial.
 *
 * Nunca se debe llamar con una sola obligación recién creada: eso permitiría
 * adelantar el pago de una nueva saltándose una anterior parcialmente impaga.
 */
export function settleObligations(obligations, { amount, month }) {
  let remaining = Math.max(0, amount);
  const queue = [...obligations]
    .filter((o) => isPayable(o) && o.outstanding > 0 && isDue(o, month))
    .sort((a, b) => a.dueMonth - b.dueMonth || String(a.id).localeCompare(String(b.id)));

  const allocations = [];
  for (const o of queue) {
    if (remaining <= 0) break;
    const pay = Math.min(o.outstanding, remaining);
    if (pay <= 0) continue;
    o.outstanding -= pay;
    o.settled += pay;
    o.settlements.push({ month, amount: pay });
    remaining -= pay;
    o.state = o.outstanding > 0 ? OBLIGATION_STATE.PARTIALLY_PAID : OBLIGATION_STATE.PAID;
    allocations.push({ id: o.id, amount: pay, dueMonth: o.dueMonth });
  }

  return {
    settled: amount - remaining,
    unallocated: remaining,
    allocations,
    order: allocations.map((a) => a.id),
  };
}

/**
 * Invariante FIFO completo: compara la tupla `(dueMonth, id)`, no sólo el
 * vencimiento. Devuelve `null` si la cola se respetó, o las obligaciones que
 * quedaron impagas teniendo prioridad sobre lo ya pagado.
 */
export function priorityViolationOf(obligations, { month }) {
  const paid = obligations.filter((o) =>
    (o.settlements || []).some((s) => s.month === month && s.amount > 0)
  );
  if (!paid.length) return null;

  const key = (o) => [o.dueMonth, String(o.id)];
  const cmp = (a, b) => a[0] - b[0] || a[1].localeCompare(b[1]);
  const maxPaid = paid.map(key).sort(cmp)[paid.length - 1];

  const violated = obligations.filter(
    (o) => isPayable(o) && o.outstanding > 0 && cmp(key(o), maxPaid) < 0
  );
  return violated.length
    ? { maxPaid, violations: violated.map((o) => o.id) }
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libros de comisión (nombres separados, sin ambigüedad)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cinco magnitudes distintas que NO se pueden mezclar:
 *  - reserved          Bunz apartados, todavía NO liberados
 *  - released          Bunz liberados del presupuesto (paso intermedio)
 *  - settledInBunz     obligación extinguida entregando Bunz (hipótesis)
 *  - fiatCollected     fiat efectivamente cobrado (NO modelado: siempre 0)
 *  - treasuryBunz      tesorería disponible en Bunz
 *
 * `fiatCollected` no tiene setter a propósito: si algún día se modela fiat,
 * tendrá que ser una función explícita y reconciliada, no un efecto lateral.
 */
export function createCommissionBooks({ endowment = 0 } = {}) {
  return {
    reserved: endowment,
    endowment,
    // El endowment es una HIPÓTESIS de fondeo del paquete, no tesorería
    // verificada. Se marca para que ningún informe lo presente como caja real.
    endowmentHypothesis: true,
    endowmentSource: "hipotesis-fondeo-paquete",
    contributions: 0,
    released: 0,
    settledInBunz: 0,
    fiatCollected: 0,
  };
}

export function contributeBooks(books, amount) {
  const a = Math.max(0, amount);
  books.contributions += a;
  books.reserved += a;
  return books;
}

export function settleBooks(books, { obligations, month }) {
  const result = settleObligations(obligations, { amount: books.reserved, month });
  books.reserved -= result.settled;
  books.released += result.settled;
  books.settledInBunz += result.settled;
  return { ...result, treasuryBunzDelta: result.settled, fiatCollected: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Autorización: compromiso protegido vs techo recalculable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dos magnitudes DISTINTAS (punto P1 de la auditoría):
 *  - `hardLimit`: tope contractual del paquete. No cambia con la demanda.
 *  - `currentCeiling`: techo calculado con la demanda/riesgo ACTUAL. Puede bajar.
 *  - `committed`: lo ya concedido. NUNCA se revoca, aunque el techo caiga.
 *
 * Disponible = max(0, min(hardLimit, currentCeiling) − committed − longOverdueReserve)
 * La deuda larga reduce sólo lo disponible, nunca lo comprometido.
 */
export function splitAuthorization({
  desired,
  committed,
  hardLimit,
  currentCeiling,
  longOverdueReserve = 0,
}) {
  const effectiveLimit = Math.min(hardLimit, currentCeiling);

  // El compromiso se conserva ÍNTEGRO. `hardLimit` acota autorizaciones NUEVAS,
  // no reescribe lo ya concedido: si el contrato queda por debajo del
  // compromiso, el modelo lo reporta como herencia, no lo recorta.
  const committedProtected = Math.max(0, committed);
  const freeBeforeDebt = Math.max(0, effectiveLimit - committedProtected);
  const available = Math.max(0, freeBeforeDebt - longOverdueReserve);
  const granted = Math.max(0, Math.min(desired, available));

  return {
    granted,
    available,
    blocked: Math.max(0, desired - granted),
    effectiveLimit,
    committedProtected,
    // Compromiso heredado por encima de cada límite (nunca se revoca).
    overHardLimit: Math.max(0, committedProtected - hardLimit),
    overEffectiveLimit: Math.max(0, committedProtected - effectiveLimit),
    hardLimitBelowCommitted: committedProtected > hardLimit + 1e-9,
    ceilingBelowCommitted: committedProtected > effectiveLimit + 1e-9,
    hardLimit,
    currentCeiling,
    longOverdueReserve,
    binding: effectiveLimit < hardLimit ? "ceiling" : "hardLimit",
  };
}

/**
 * Orden de ejecución explícito: primero el techo/compromiso/mora, y SOLO
 * después los caps de concentración sobre lo que realmente se puede autorizar.
 * Así la concentración final no puede diferir de la que evaluaron los caps.
 */
export function authorizeWithCaps({
  desired,
  committed,
  hardLimit,
  currentCeiling,
  longOverdueReserve = [],
  existing,
  category = null,
  dynamicCaps = false,
  caps = CAPS,
}) {
  const splits = desired.map((d, i) =>
    splitAuthorization({
      desired: d,
      committed: committed[i],
      hardLimit: hardLimit[i],
      currentCeiling: currentCeiling[i],
      longOverdueReserve: longOverdueReserve[i] ?? 0,
    })
  );
  const afterLimits = splits.map((s) => s.granted);

  const capPhase = dynamicCaps
    ? applyConcentrationCaps({
        existing,
        desiredNew: afterLimits,
        category,
        top1: caps.top1,
        top3: caps.top3,
        hhi: caps.hhi,
        categoryCap: caps.category,
      })
    : null;

  const granted = capPhase ? capPhase.newStock : afterLimits;
  return {
    granted,
    splits,
    caps: capPhase,
    blockedByLimit: sum(splits.map((s) => s.blocked)),
    blockedByCaps: capPhase ? capPhase.blocked : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Concentración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Única fuente de verdad para concentración. Se mide sobre la capacidad REAL
 * (live / final), no sobre la asignación preliminar.
 */
export function concentrationOf(points, categories = null) {
  const total = sum(points);
  const sorted = [...points].sort((a, b) => b - a);
  const top1 = total > 0 ? sorted[0] / total : 0;
  const top3 = total > 0 ? sum(sorted.slice(0, Math.min(3, points.length))) / total : 0;
  const hhi = total > 0 ? points.reduce((a, x) => a + Math.pow(x / total, 2), 0) : 0;

  const byCategory = {};
  if (categories) {
    for (const c of [...new Set(categories)]) {
      let s = 0;
      for (let i = 0; i < points.length; i++) if (categories[i] === c) s += points[i];
      byCategory[c] = total > 0 ? s / total : 0;
    }
  }

  return { total, top1, top3, hhi, byCategory };
}

export const CAPS = { top1: 0.25, top3: 0.6, hhi: 0.15, category: 0.5 };

/** Devuelve la violación máxima RELATIVA (0 = cumple) para un vector de capacidad. */
export function capsViolationOf(points, categories = null, caps = CAPS) {
  const c = concentrationOf(points, categories);
  if (c.total <= 0) return { violation: 0, metrics: c };
  let v = c.top1 - caps.top1;
  v = Math.max(v, c.top3 - caps.top3);
  v = Math.max(v, c.hhi - caps.hhi);
  if (categories) {
    for (const share of Object.values(c.byCategory)) v = Math.max(v, share - caps.category);
  }
  return { violation: v, metrics: c };
}

/**
 * Clasifica el resultado de los caps en cuatro estados excluyentes:
 *  - `cumplido`               los caps se cumplen al cierre del intento
 *  - `recuperacion-parcial`   se concedió algo y el exceso persiste
 *  - `recuperacion-bloqueada` no cabe ninguna concesión sin empeorar
 *  - `infactible`             el reparto pedido no puede cumplir los caps
 * Medir una infracción mes a mes NO es garantizar su cumplimiento.
 */
/**
 * Estado de cumplimiento DERIVADO DE LA MEDICIÓN REAL al cierre del mes.
 * No confundir con `capStatusOf()`, que describe el PROCESO de autorización.
 */
export function capRealStatusOf(violation, { total = 0, tol = 1e-9 } = {}) {
  if (total <= 0) return "indefinido";
  return violation > tol ? "incumplido" : "cumplido";
}

export function capStatusOf(result) {
  if (!result) return "sin-caps";
  if (result.feasible) return "cumplido";
  if (result.recovery) {
    return sum(result.newStock) > 1e-9 ? "recuperacion-parcial" : "recuperacion-bloqueada";
  }
  return "infactible";
}

/**
 * Capacidad heredada que excede los caps y NO puede corregirse sin revocar
 * compromisos. Se expresa en unidades de capacidad (Bunz), no en porcentaje.
 * HHI no se traduce a capacidad: se reporta aparte como violación de ratio.
 */
export function inheritedExcessOf(points, categories = null, caps = CAPS) {
  const c = concentrationOf(points, categories);
  if (c.total <= 0) return 0;
  let excess = Math.max(0, c.top1 - caps.top1, c.top3 - caps.top3) * c.total;
  if (categories) {
    for (const share of Object.values(c.byCategory)) {
      excess = Math.max(excess, Math.max(0, share - caps.category) * c.total);
    }
  }
  return excess;
}

/**
 * Caps aplicados SOLO a nuevas autorizaciones. `existing` nunca se modifica.
 *
 * Modos:
 *  - normal: factible o infactible; si es infactible se explica.
 *  - recuperación: si `existing` ya viola, se bloquean sólo las nuevas
 *    autorizaciones de los afiliados que forman el exceso.
 *
 * `reason` es no nulo SIEMPRE que `feasible === false`.
 */
export function applyConcentrationCaps({
  existing,
  desiredNew,
  category = null,
  top1 = CAPS.top1,
  top3 = CAPS.top3,
  hhi = CAPS.hhi,
  categoryCap = CAPS.category,
}) {
  const caps = { top1, top3, hhi, category: categoryCap };
  const n = existing.length;
  const desired = desiredNew.map((x) => Math.max(0, x));
  const D = sum(desired);
  const tol = 1e-9;

  const before = capsViolationOf(existing, category, caps);
  const recovery = before.violation > tol;
  const ceiling = recovery ? before.violation + tol : tol;

  // Afiliados que forman el exceso (sólo en recuperación).
  const offending = new Set();
  if (recovery) {
    const t = before.metrics.total;
    const order = existing.map((e, i) => i).sort((a, b) => existing[b] - existing[a]);
    existing.forEach((e, i) => {
      if (t > 0 && e / t - top1 > tol) offending.add(i);
    });
    const top3Idx = order.slice(0, Math.min(3, n));
    if (t > 0 && top3Idx.reduce((a, i) => a + existing[i], 0) / t - top3 > tol) {
      for (const i of top3Idx) offending.add(i);
    }
    if (t > 0 && Math.sqrt(before.metrics.hhi) - Math.sqrt(hhi) > tol) {
      offending.add(order[0]);
    }
    if (category && t > 0) {
      for (const [c, share] of Object.entries(before.metrics.byCategory)) {
        if (share - categoryCap > tol) {
          category.forEach((cc, i) => {
            if (String(cc) === String(c)) offending.add(i);
          });
        }
      }
    }
  }

  // Techo absoluto por entidad (usa el total máximo posible).
  const Tmax = sum(existing) + D;
  let rem = desired.map((d, i) => (offending.has(i) ? 0 : d));
  if (Tmax > 0) {
    rem = rem.map((d) => Math.min(d, top1 * Tmax));
    if (category) rem = rem.map((d) => Math.min(d, categoryCap * Tmax));
  }

  const okAt = (x) => capsViolationOf(existing.map((e, i) => e + x[i]), category, caps).violation <= ceiling;

  let x = desired.map(() => 0);
  let scale = 0;
  for (let round = 0; round < 12; round++) {
    const pending = rem.map((d, i) => Math.max(0, d - x[i]));
    if (sum(pending) <= 1e-9) break;
    if (okAt(x.map((v, i) => v + pending[i]))) {
      x = x.map((v, i) => v + pending[i]);
      break;
    }
    if (!okAt(x)) break;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (okAt(x.map((v, j) => v + mid * pending[j]))) lo = mid;
      else hi = mid;
    }
    if (lo <= 1e-12) break;
    x = x.map((v, i) => v + lo * pending[i]);
    if (round === 0) scale = lo;
  }

  const final = existing.map((e, i) => e + x[i]);
  const after = capsViolationOf(final, category, caps);
  const granted = sum(x);
  // "Factible" = los caps se cumplen Y se pudo autorizar algo (si había demanda).
  // Autorizar cero no es cumplir: es no poder operar.
  const feasible = after.violation <= tol && (granted > 1e-9 || D <= 1e-9);

  // Diagnóstico completo: `reason` nunca queda vacío si no es factible.
  let reason = null;
  if (!feasible) {
    if (granted <= 1e-9 && recovery) reason = "recuperacion-bloquea-todo";
    else if (granted <= 1e-9 && D > 1e-9) reason = "reparto-incompatible-con-caps";
    else if (granted <= 1e-9) reason = "sin-demanda-y-cap-ya-violado";
    else reason = "recuperacion-parcial";
  }

  return {
    newStock: x,
    blocked: Math.max(0, D - granted),
    feasible,
    reason,
    recovery,
    scale,
    offending: [...offending],
    violationBefore: Number(before.violation.toFixed(6)),
    violationAfter: Number(after.violation.toFixed(6)),
    metricsBefore: before.metrics,
    metricsAfter: after.metrics,
    caps,
  };
}
