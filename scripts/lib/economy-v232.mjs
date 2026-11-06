/**
 * ── Bunz Economy v2.3.2 — librería pura de validación ─────────────────────
 * Sin DB, sin producción. Funciones testables:
 *  - redistribución real de demanda entre afiliados + movilidad
 *  - ciclo de vida de obligaciones (disputa, resolución, pago parcial)
 *  - autorización acumulada
 *  - caps dinámicos de concentración
 */

export const sum = (xs) => xs.reduce((a, x) => a + x, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Redistribución
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mobility: 0 = nula, 0.5 = parcial, 1 = perfecta.
 * Devuelve demanda local, reasignada, servida, unmet local y de ecosistema.
 */
export function redistribute({ requested, capacity, mobility = 1 }) {
  const n = requested.length;
  const servedLocal = requested.map((r, i) => Math.min(r, capacity[i]));
  const unmetLocal = requested.map((r, i) => r - servedLocal[i]);
  const spare = capacity.map((c, i) => Math.max(0, c - servedLocal[i]));

  const totalUnmet = sum(unmetLocal);
  const totalSpare = sum(spare);
  const movable = Math.min(totalUnmet * Math.max(0, Math.min(1, mobility)), totalSpare);

  // Demanda que sale de cada origen (proporcional a su unmet local)
  const movedFrom = unmetLocal.map((u) => (totalUnmet > 0 ? (movable * u) / totalUnmet : 0));

  // Capacidad que recibe demanda de otros (proporcional al spare)
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

export function createObligation({ id, amount, month, dueMonth, disputed = false }) {
  return {
    id,
    amount,
    outstanding: amount,
    createdMonth: month,
    dueMonth,
    state: disputed ? OBLIGATION_STATE.DISPUTED : OBLIGATION_STATE.OPEN,
    resolvedAt: null,
    writtenOff: 0,
  };
}

export function resolveDispute(obligation, month, payable) {
  if (obligation.state !== OBLIGATION_STATE.DISPUTED) return false;
  obligation.state = payable ? OBLIGATION_STATE.RESOLVED_PAYABLE : OBLIGATION_STATE.RESOLVED_NOT_PAYABLE;
  obligation.resolvedAt = month;
  if (!payable) {
    obligation.writtenOff = obligation.outstanding;
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

export function outstandingOf(obligations, {
  month = Infinity,
  overdue = false,
  longOverdue = false,
  includeDisputed = false,
} = {}) {
  return obligations.reduce((acc, o) => {
    if (o.outstanding <= 0) return acc;
    if (o.state === OBLIGATION_STATE.PAID || o.state === OBLIGATION_STATE.RESOLVED_NOT_PAYABLE) return acc;
    if (o.state === OBLIGATION_STATE.DISPUTED && !includeDisputed) return acc;
    if (overdue && o.dueMonth > month) return acc;
    if (longOverdue && o.dueMonth > month - 1) return acc;
    return acc + o.outstanding;
  }, 0);
}

export function payObligations(obligations, amount, month) {
  let remaining = Math.max(0, amount);
  const ordered = [...obligations].sort((a, b) => a.dueMonth - b.dueMonth || String(a.id).localeCompare(String(b.id)));
  for (const o of ordered) {
    if (remaining <= 0) break;
    if (!isPayable(o)) continue;
    const pay = Math.min(o.outstanding, remaining);
    o.outstanding -= pay;
    remaining -= pay;
    o.state = o.outstanding > 0 ? OBLIGATION_STATE.PARTIALLY_PAID : OBLIGATION_STATE.PAID;
  }
  return amount - remaining;
}

// ─────────────────────────────────────────────────────────────────────────────
// Autorización acumulada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `maxAuthorizable` es ACUMULADO (horizonte). El paquete consume el límite.
 * La deuda larga vencida reduce lo DISPONIBLE, no lo ya comprometido.
 */
export function authorizeStock({ desired, committed, limit, longOverdue = 0 }) {
  const available = Math.max(0, limit - committed - longOverdue);
  const granted = Math.max(0, Math.min(desired, available));
  return { granted, available, blocked: Math.max(0, desired - granted) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caps dinámicos de concentración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los caps se aplican SOLO a nuevas autorizaciones (`desiredNew`).
 * `existing` es inmutable: nunca se revoca capacidad ya comprometida.
 *
 * Todas las restricciones son sobre PARTICIPACIONES del total (top1, top3, HHI,
 * categoría). Eso las hace homogéneas: escalar la autorización nueva no cambia
 * la participación si `existing` está vacío. Por eso el algoritmo:
 *
 *  1. aplica un techo absoluto por entidad (top1·Tmax, categoría·Tmax);
 *  2. escala uniformemente la autorización hasta el máximo punto factible;
 *  3. reintenta con la demanda restante de las entidades no capeadas.
 *
 * Si `existing` ya viola un cap se entra en modo RECUPERACIÓN: no se revoca
 * nada, se bloquean solo las nuevas autorizaciones de los afiliados que forman
 * el exceso, y se permite crecer a los demás para diluir la concentración.
 */
export function applyConcentrationCaps({
  existing,
  desiredNew,
  category = null,
  top1 = 0.25,
  top3 = 0.6,
  hhi = 0.15,
  categoryCap = 0.5,
}) {
  const n = existing.length;
  const desired = desiredNew.map((x) => Math.max(0, x));
  const D = sum(desired);

  const metricsOf = (p) => {
    const t = sum(p);
    const sorted = [...p].sort((a, b) => b - a);
    return {
      total: t,
      top1: t > 0 ? sorted[0] / t : 0,
      top3: t > 0 ? sum(sorted.slice(0, Math.min(3, n))) / t : 0,
      hhi: t > 0 ? p.reduce((a, x) => a + Math.pow(x / t, 2), 0) : 0,
      category: category
        ? [...new Set(category)].map((c) => {
            const idx = category.map((x, i) => (x === c ? i : -1)).filter((i) => i >= 0);
            const sc = idx.reduce((a, i) => a + p[i], 0);
            return t > 0 ? sc / t : 0;
          })
        : [],
    };
  };

  // Violación máxima (0 = factible). Todas las restricciones son lineales en la
  // escala, salvo HHI (cuadrática → se compara en raíces).
  // Violación RELATIVA al total (adimensional). Sin esto, totales diminutos
  // "cumplen" los caps por tolerancia absoluta y se autoriza capacidad inútil.
  const violationOf = (p) => {
    const t = sum(p);
    if (t <= 0) return 0;
    let v = 0;
    v = Math.max(v, Math.max(...p) / t - top1);
    const sorted = [...p].sort((a, b) => b - a);
    v = Math.max(v, sum(sorted.slice(0, Math.min(3, n))) / t - top3);
    const s2 = p.reduce((a, x) => a + x * x, 0);
    v = Math.max(v, Math.sqrt(s2 / (t * t)) - Math.sqrt(hhi));
    if (category) {
      for (const c of [...new Set(category)]) {
        const idx = category.map((x, i) => (x === c ? i : -1)).filter((i) => i >= 0);
        v = Math.max(v, idx.reduce((a, i) => a + p[i], 0) / t - categoryCap);
      }
    }
    return v;
  };

  const tol = 1e-9; // relativo al total

  const v0 = violationOf(existing);
  const recovery = v0 > tol;

  // ── Modo recuperación ───────────────────────────────────────────────────
  // Si la capacidad YA comprometida viola un cap, no se revoca nada. Solo se
  // bloquean nuevas autorizaciones a los afiliados que forman el exceso; los
  // demás pueden crecer y diluir la concentración.
  const offending = new Set();
  if (recovery) {
    const t = sum(existing);
    const order = existing.map((e, i) => i).sort((a, b) => existing[b] - existing[a]);
    existing.forEach((e, i) => {
      if (e / t - top1 > tol) offending.add(i);
    });
    const top3Idx = order.slice(0, Math.min(3, n));
    if (top3Idx.reduce((a, i) => a + existing[i], 0) / t - top3 > tol) {
      for (const i of top3Idx) offending.add(i);
    }
    const s2 = existing.reduce((a, x) => a + x * x, 0);
    if (Math.sqrt(s2 / (t * t)) - Math.sqrt(hhi) > tol) offending.add(order[0]);
    if (category) {
      for (const c of [...new Set(category)]) {
        const idx = category.map((x, i) => (x === c ? i : -1)).filter((i) => i >= 0);
        const share = idx.reduce((a, i) => a + existing[i], 0) / t;
        if (share - categoryCap > tol) for (const i of idx) offending.add(i);
      }
    }
  }

  // Techo absoluto por entidad: evita que un afiliado dominante siga creciendo
  // aunque su participación no empeore.
  const Tmax = sum(existing) + D;
  let rem = desired.map((d, i) => (offending.has(i) ? 0 : d));
  if (Tmax > 0) {
    rem = rem.map((d) => Math.min(d, top1 * Tmax));
    if (category) rem = rem.map((d) => Math.min(d, categoryCap * Tmax));
  }

  // Criterio: factible de pleno derecho, o (en recuperación) no empeorar.
  const ceiling = recovery ? v0 + tol : tol;
  const okAt = (x) => violationOf(existing.map((e, i) => e + x[i])) <= ceiling;

  // Escala uniforme máxima + reasignación de la demanda restante.
  let x = desired.map(() => 0);
  let scale = 0;
  for (let round = 0; round < 12; round++) {
    const pending = rem.map((d, i) => Math.max(0, d - x[i]));
    if (sum(pending) <= 1e-9) break;
    if (okAt(x.map((v, i) => v + pending[i]))) {
      x = x.map((v, i) => v + pending[i]);
      break;
    }
    let lo = 0;
    let hi = 1;
    if (!okAt(x)) break;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (okAt(x.map((v, j) => v + mid * pending[j]))) lo = mid;
      else hi = mid;
    }
    if (lo <= 1e-12) break;
    x = x.map((v, i) => v + lo * pending[i]);
    if (round === 0) scale = lo;
  }

  const report = (next, extra) => {
    const p = existing.map((e, i) => e + next[i]);
    const m = metricsOf(p);
    return {
      newStock: next,
      blocked: Math.max(0, D - sum(next)),
      top1: m.top1,
      top3: m.top3,
      hhi: m.hhi,
      category: m.category,
      ...extra,
    };
  };

  const final = existing.map((e, i) => e + x[i]);
  const stillViolating = violationOf(final) > tol;
  const grantedSomething = sum(x) > 1e-9;

  let reason = null;
  if (!grantedSomething && D > 1e-9) {
    reason = recovery ? "recuperacion-bloquea-todo" : "caps-incompatibles-con-reparto";
  }

  return report(x, {
    // `feasible`: los caps se cumplen al final. Si no se pudo autorizar nada
    // habiendo demanda, son incompatibles con el reparto (nunca "cumple").
    feasible: !stillViolating && (grantedSomething || D <= 1e-9),
    reason,
    scale,
    recovery,
    blockedEntities: [...offending],
    violationBefore: Number(v0.toFixed(6)),
    violationAfter: Number(violationOf(final).toFixed(6)),
  });
}
