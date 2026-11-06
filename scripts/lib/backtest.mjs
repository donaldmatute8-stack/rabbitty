/**
 * ── Backtest / calibración aislada (v1.0) ────────────────────────────────────
 * Toma un dataset que CUMPLE el contrato (real-data-spec v1.0), deriva los
 * parámetros medidos, ejecuta el simulador con la demanda observada y compara
 * las series resultantes con las observadas.
 *
 * NO aprueba nada: un ajuste aceptable solo significa "el modelo no contradice
 * los datos en estas métricas". El veredicto nunca es "aprobado".
 */

import { run } from "../economy-sim-v2323.mjs";
import { asOf, createJournalFromOccurrence, exportHash } from "./asof.mjs";
import {
  SPEC_VERSION,
  activeEvents,
  computeMetrics,
  runValidation,
} from "./real-data-spec.mjs";

const EPS = 1e-9;
const sum = (xs) => xs.reduce((a, x) => a + x, 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

const monthOf = (d) => String(d).slice(0, 7);
const monthEnd = (m) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
};

const withWindow = (dataset, months) => ({
  ...dataset,
  window: {
    ...dataset.window,
    operational: { from: `${months[0]}-01`, to: monthEnd(months[months.length - 1]) },
  },
});

const monthsBetween = (from, to) => {
  const out = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
};

export const THRESHOLDS = {
  mape_max: 0.25, // volumen redimido / no atendido
  mape_max_debt: 0.35, // pendiente (más volátil)
  concentration_pp_max: 5, // puntos porcentuales en top3
  min_months: 3,
};

export const DISCLAIMER =
  "Un ajuste aceptable NO aprueba la economía Bunz: solo indica que el modelo no " +
  "contradice estos datos en estas métricas. Las decisiones económicas siguen pendientes " +
  "y RP-2 sigue bloqueado.";

// ── Parámetros medidos desde eventos ─────────────────────────────────────────

export function deriveParameters(dataset) {
  const active = (dataset.affiliates || []).filter((a) => a.status === "active");
  const grossBy = new Map();
  for (const s of dataset.sales || []) {
    grossBy.set(s.affiliate_id, (grossBy.get(s.affiliate_id) || 0) + s.gross_mxn);
  }
  const ids = active.filter((a) => grossBy.has(a.id)).map((a) => a.id);
  const totalGross = sum(ids.map((id) => grossBy.get(id) || 0)) || 1;

  const demand = ids.map((id) => (grossBy.get(id) || 0) / totalGross);

  const lastCapacity = new Map();
  for (const c of dataset.capacity || []) {
    const prev = lastCapacity.get(c.affiliate_id);
    if (!prev || String(c.date) > String(prev.date)) lastCapacity.set(c.affiliate_id, c);
  }
  const totalCap = sum(ids.map((id) => num(lastCapacity.get(id)?.authorized_bunz))) || 1;
  const capacity = ids.map((id) => num(lastCapacity.get(id)?.authorized_bunz) / totalCap);

  const reqBy = new Map();
  for (const r of activeEvents(dataset.redemptions)) {
    reqBy.set(r.requested_affiliate, (reqBy.get(r.requested_affiliate) || 0) + r.bunz);
  }
  const totalReq = sum(ids.map((id) => reqBy.get(id) || 0)) || 1;
  const redemption = ids.map((id) => (reqBy.get(id) || 0) / totalReq);

  const months = monthsBetween(dataset.window.operational.from, dataset.window.operational.to);
  const fiatSeries = months.map((m) =>
    sum((dataset.sales || []).filter((s) => monthOf(s.ts) === m).map((s) => s.gross_mxn))
  );

  const metrics = computeMetrics(dataset);
  const grossTotal = sum(fiatSeries) || 1;
  const emittedTotal = metrics.emitted_bunz || 1;

  const rewardRate = clamp(emittedTotal / grossTotal, 0.001, 1);
  const expectedRedemptionRatio = clamp(metrics.redeemed_bunz / emittedTotal, 0.001, 1);

  const obs = observedMonthly(dataset);
  const ratios = [];
  for (let i = 1; i < obs.months.length; i++) {
    if (obs.circulating[i - 1] > 1) ratios.push(obs.redeemed[i] / obs.circulating[i - 1]);
  }
  const redemptionRate = clamp(ratios.length ? sum(ratios) / ratios.length : 0.5, 0.05, 1);

  const capacityRows = dataset.capacity || [];
  const idle = sum(capacityRows.map((c) => Math.max(0, c.authorized_bunz - c.consumed_bunz)));
  const consumed = sum(capacityRows.map((c) => c.consumed_bunz));
  const coverageDays = clamp(30 * (idle / Math.max(1, capacityRows.length)) / Math.max(1, consumed / Math.max(1, capacityRows.length)), 1, 180);

  const obligations = activeEvents(dataset.obligations);
  const disputedShare = obligations.length
    ? obligations.filter((o) => o.state === "DISPUTED").length / obligations.length
    : 0;

  return {
    n: ids.length,
    affiliates: ids,
    months: months.length,
    demand,
    capacity,
    redemption,
    fiatSeries,
    rewardRate,
    redemptionRate,
    expectedRedemptionRatio,
    coverageDays,
    mobility: metrics.mobility_rate_amount ?? 0,
    disputedShare,
    packageScale: Math.max(1e-6, (fiatSeries[0] || 1) / 1_000_000),
    observed: {
      emitted_bunz: metrics.emitted_bunz,
      redeemed_bunz: metrics.redeemed_bunz,
      unmet_economic_bunz: metrics.unmet_economic_bunz,
      outstanding_bunz: metrics.outstanding_bunz,
      circulating_bunz: metrics.circulating_bunz,
      treasury_bunz: metrics.treasury_bunz,
    },
  };
}

// ── Series observadas ───────────────────────────────────────────────────────

export function observedMonthly(dataset) {
  const months = monthsBetween(dataset.window.operational.from, dataset.window.operational.to);
  const ends = months.map(monthEnd);
  const redemptions = activeEvents(dataset.redemptions);
  const obligations = activeEvents(dataset.obligations);
  const ledger = [...(dataset.bunz_ledger || [])].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const treasury = [...(dataset.treasury || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const redeemed = months.map((m) =>
    sum(redemptions.filter((r) => r.fulfilled_at && monthOf(r.fulfilled_at) === m).map((r) => r.fulfilled_bunz || 0))
  );

  const unmet = months.map((m) => {
    let total = 0;
    for (const r of redemptions) {
      if (monthOf(r.requested_at) !== m) continue;
      if (["fulfilled", "duplicate", "fraud"].includes(r.status)) continue;
      const defs = r.reasons || [];
      const economic = defs.some((x) => ["capacity_exhausted", "out_of_stock", "affiliate_refused"].includes(x));
      if (economic) total += Math.max(0, r.bunz - (r.fulfilled_bunz || 0));
    }
    return total;
  });

  const outstanding = ends.map((end) => {
    let total = 0;
    for (const o of obligations) {
      if (o.accrued_at > end) continue;
      let paid = 0;
      if (o.settled_at && o.settled_at <= end) paid += num(o.settled_bunz) + num(o.settled_fiat_mxn);
      if (o.written_off_at && o.written_off_at <= end) paid += o.bunz;
      total += Math.max(0, o.bunz - paid);
    }
    return total;
  });

  const balanceAt = (end, account) => {
    let b = 0;
    for (const e of ledger) {
      if (String(e.ts).slice(0, 10) > end) break;
      if (e.account !== account) continue;
      b += (e.direction === "credit" ? 1 : -1) * e.amount;
    }
    return b;
  };
  const circulating = ends.map((end) => balanceAt(end, "user_wallet"));
  const treasuryBunz = ends.map((end) => {
    const snap = treasury.filter((t) => t.date <= end).at(-1);
    return snap ? num(snap.bunz_balance) : 0;
  });

  const cap = dataset.capacity || [];
  const byAffiliate = new Map();
  for (const c of cap) byAffiliate.set(c.affiliate_id, Math.max(byAffiliate.get(c.affiliate_id) || 0, c.authorized_bunz));
  const totalCap = sum([...byAffiliate.values()]);
  const sorted = [...byAffiliate.values()].sort((a, b) => b - a);
  const cats = new Map((dataset.affiliates || []).map((a) => [a.id, a.category]));
  const catTotals = new Map();
  for (const [id, v] of byAffiliate) {
    const c = cats.get(id) ?? "n/a";
    catTotals.set(c, (catTotals.get(c) || 0) + v);
  }

  return {
    months,
    redeemed,
    unmet_economic: unmet,
    outstanding,
    circulating,
    treasury: treasuryBunz,
    concentration: {
      total: totalCap,
      top1: totalCap > 0 ? (sorted[0] || 0) / totalCap : 0,
      top3: totalCap > 0 ? sum(sorted.slice(0, 3)) / totalCap : 0,
      hhi: totalCap > 0 ? sum(sorted.map((x) => Math.pow(x / totalCap, 2))) : 0,
      by_category: Object.fromEntries([...catTotals].map(([c, v]) => [c, totalCap > 0 ? v / totalCap : 0])),
    },
  };
}

// ── Series por segmento (categoría × tamaño) ────────────────────────────────

const ECONOMIC = ["capacity_exhausted", "out_of_stock", "affiliate_refused"];
const cellOf = (a) => `${a.category}|${a.size_band}`;

export function observedBySegment(dataset, months) {
  const cell = new Map((dataset.affiliates || []).map((a) => [a.id, cellOf(a)]));
  const seg = new Map();
  const ensure = (k) => {
    if (!seg.has(k)) seg.set(k, { redeemed: months.map(() => 0), unmet: months.map(() => 0) });
    return seg.get(k);
  };

  for (const r of activeEvents(dataset.redemptions)) {
    if (r.fulfilled_at && r.fulfilled_affiliate) {
      const m = months.indexOf(monthOf(r.fulfilled_at));
      if (m >= 0) ensure(cell.get(r.fulfilled_affiliate) ?? "n/a").redeemed[m] += r.fulfilled_bunz || 0;
    }
    if (["fulfilled", "duplicate", "fraud"].includes(r.status)) continue;
    if (!(r.reasons || []).some((x) => ECONOMIC.includes(x))) continue;
    const m = months.indexOf(monthOf(r.requested_at));
    if (m >= 0) {
      ensure(cell.get(r.requested_affiliate) ?? "n/a").unmet[m] += Math.max(0, r.bunz - (r.fulfilled_bunz || 0));
    }
  }
  return seg;
}

export function simulatedBySegment(history, meta) {
  const seg = new Map();
  const ensure = (k) => {
    if (!seg.has(k)) seg.set(k, { redeemed: history.map(() => 0), unmet: history.map(() => 0) });
    return seg.get(k);
  };
  history.forEach((h, m) => {
    for (const b of h.byBusiness || []) {
      const a = meta[b.id];
      const k = a ? cellOf(a) : "n/a";
      ensure(k).redeemed[m] += b.served;
      ensure(k).unmet[m] += b.unmet;
    }
  });
  return seg;
}

// ── Comparación ────────────────────────────────────────────────────────────

export function compareSeries(observed, simulated) {
  const n = Math.min(observed.length, simulated.length);
  let abs = 0;
  let signed = 0;
  let pct = 0;
  let pctCount = 0;
  let obsSum = 0;

  for (let i = 0; i < n; i++) {
    const o = num(observed[i]);
    const s = num(simulated[i]);
    const err = s - o;
    abs += Math.abs(err);
    signed += err;
    obsSum += Math.abs(o);
    if (Math.abs(o) > EPS) {
      pct += Math.abs(err) / Math.abs(o);
      pctCount++;
    }
  }

  return {
    n,
    mae: n ? abs / n : null,
    mape: pctCount ? pct / pctCount : null,
    mape_months: pctCount,
    bias: n ? signed / n : null,
    bias_pct: obsSum > 0 ? signed / obsSum : null,
    observed_mean: n ? obsSum / n : null,
    simulated_mean: n ? sum(simulated.slice(0, n).map(num)) / n : null,
  };
}

// ── Backtest completo ──────────────────────────────────────────────────────

export function runBacktest(
  dataset,
  { thresholds = THRESHOLDS, mode = "temporal", splitIndex } = {}
) {
  const validation = runValidation(dataset);
  if (!validation.ok) {
    return {
      spec_version: SPEC_VERSION,
      verdict: "no-apto",
      reason: "el dataset no cumple el contrato: no se calibra",
      errors: validation.errors,
      disclaimer: DISCLAIMER,
    };
  }
  if (!validation.calibration_ready) {
    return {
      spec_version: SPEC_VERSION,
      verdict: "no-apto",
      reason: "cobertura o metadatos insuficientes: se extiende la observación, no se calibra",
      warnings: validation.warnings,
      coverage: validation.coverage,
      disclaimer: DISCLAIMER,
    };
  }

  const obsAll = observedMonthly(dataset);
  const months = obsAll.months;
  if (months.length < thresholds.min_months) {
    return {
      spec_version: SPEC_VERSION,
      verdict: "no-apto",
      reason: `ventana operativa de ${months.length} meses (< ${thresholds.min_months})`,
      disclaimer: DISCLAIMER,
    };
  }

  const temporal = mode !== "in_sample";
  const k = splitIndex ?? Math.max(1, Math.ceil(months.length * 0.66));
  const calMonths = temporal ? months.slice(0, k) : months;
  const evalMonths = temporal ? months.slice(k) : months;
  if (!calMonths.length || !evalMonths.length) {
    return {
      spec_version: SPEC_VERSION,
      verdict: "no-apto",
      reason: "split sin meses en calibración o evaluación",
      disclaimer: DISCLAIMER,
    };
  }

  // Materialización as-of: la calibración solo ve lo conocido al cierre de A.
  const journal = temporal ? createJournalFromOccurrence(dataset) : null;
  const calCut = monthEnd(calMonths[calMonths.length - 1]);
  const evalCut = monthEnd(evalMonths[evalMonths.length - 1]);
  const calExport = temporal ? asOf(journal, calCut) : dataset;
  const evalExport = temporal ? asOf(journal, evalCut) : dataset;

  // Parámetros: SOLO de la ventana de calibración (nunca de la evaluación).
  const params = deriveParameters(withWindow(calExport, calMonths));

  const evalObs = observedMonthly(evalExport);
  const idx = evalMonths.map((m) => evalObs.months.indexOf(m)).filter((i) => i >= 0);
  const obs = {
    months: evalMonths,
    redeemed: idx.map((i) => evalObs.redeemed[i]),
    unmet_economic: idx.map((i) => evalObs.unmet_economic[i]),
    outstanding: idx.map((i) => evalObs.outstanding[i]),
    circulating: idx.map((i) => evalObs.circulating[i]),
    treasury: idx.map((i) => evalObs.treasury[i]),
    concentration: evalObs.concentration,
  };

  const evalFiat = evalMonths.map((m) =>
    sum((evalExport.sales || []).filter((s) => monthOf(s.ts) === m).map((s) => s.gross_mxn))
  );

  const scenario = {
    label: "backtest",
    n: params.n,
    months: evalMonths.length,
    demand: params.demand,
    capacity: params.capacity,
    redemption: params.redemption,
    fiatSeries: evalFiat,
    rewardRate: params.rewardRate,
    redemptionRate: params.redemptionRate,
    expectedRedemptionRatio: params.expectedRedemptionRatio,
    coverageDays: params.coverageDays,
    mobility: params.mobility,
    disputedShare: params.disputedShare,
    // La escala del paquete se fija en calibración: no se re-dimensiona con la
    // demanda de evaluación (sería usar información del futuro).
    packageScale: params.packageScale,
    dynamicCaps: false,
    byBusiness: true,
    seed: 42,
  };

  const sim = run(scenario);
  const history = sim.history;

  const series = {
    redeemed_bunz: compareSeries(obs.redeemed, history.map((h) => h.served)),
    unmet_economic_bunz: compareSeries(obs.unmet_economic, history.map((h) => h.unmetEcosystem)),
  };
  const nonComparable = [];
  if (temporal) {
    // Sin inyección de estado, el arranque en 0 sesga las series de stock.
    nonComparable.push("outstanding_bunz", "circulating_bunz", "treasury_bunz");
  } else {
    series.outstanding_bunz = compareSeries(obs.outstanding, history.map((h) => h.outstanding));
    series.circulating_bunz = compareSeries(obs.circulating, history.map((h) => h.C));
    series.treasury_bunz = compareSeries(obs.treasury, history.map((h) => h.T));
  }

  // Error por segmento: mismo esquema que la comparación agregada.
  const meta = params.affiliates.map((id) => {
    const a = (dataset.affiliates || []).find((x) => x.id === id);
    return { id, category: a?.category ?? "n/a", size_band: a?.size_band ?? "n/a" };
  });
  const obsSeg = observedBySegment(evalExport, evalMonths);
  const simSeg = simulatedBySegment(history, meta);
  const segKeys = [...new Set([...obsSeg.keys(), ...simSeg.keys()])].sort();
  const zeros = evalMonths.map(() => 0);
  const segments = segKeys.map((key) => ({
    segment: key,
    redeemed: compareSeries(obsSeg.get(key)?.redeemed ?? zeros, simSeg.get(key)?.redeemed ?? zeros),
    unmet: compareSeries(obsSeg.get(key)?.unmet ?? zeros, simSeg.get(key)?.unmet ?? zeros),
  }));

  const simConc = { top1: history.at(-1).top1, top3: history.at(-1).top3, hhi: history.at(-1).hhi };
  const concentration = {
    observed: obs.concentration,
    simulated: simConc,
    delta_pp: {
      top1: (simConc.top1 - obs.concentration.top1) * 100,
      top3: (simConc.top3 - obs.concentration.top3) * 100,
      hhi: (simConc.hhi - obs.concentration.hhi) * 100,
    },
  };

  const checks = [
    {
      name: "redeemed",
      ok: series.redeemed_bunz.mape === null ? true : series.redeemed_bunz.mape <= thresholds.mape_max,
      value: series.redeemed_bunz.mape,
    },
    {
      name: "unmet",
      ok: series.unmet_economic_bunz.mape === null ? true : series.unmet_economic_bunz.mape <= thresholds.mape_max,
      value: series.unmet_economic_bunz.mape,
    },
    {
      name: "concentracion_top3",
      ok: Math.abs(concentration.delta_pp.top3) <= thresholds.concentration_pp_max,
      value: concentration.delta_pp.top3,
    },
  ];
  if (!temporal) {
    checks.push({
      name: "outstanding",
      ok:
        series.outstanding_bunz.mape === null
          ? true
          : series.outstanding_bunz.mape <= thresholds.mape_max_debt,
      value: series.outstanding_bunz.mape,
    });
  }

  const failed = checks.filter((c) => !c.ok);

  return {
    spec_version: SPEC_VERSION,
    verdict: failed.length === 0 ? "ajuste-aceptable" : "ajuste-debil",
    mode,
    in_sample: !temporal,
    params_source: temporal ? `calibración as-of ${calCut}` : "ventana completa (en muestra)",
    calibration: temporal
      ? { months: calMonths, cut: calCut, export_hash: exportHash(calExport), params }
      : null,
    evaluation: temporal
      ? { months: evalMonths, cut: evalCut, export_hash: exportHash(evalExport) }
      : null,
    non_comparable_series: nonComparable,
    failed_checks: failed.map((c) => c.name),
    thresholds,
    parameters: {
      n: params.n,
      months: params.months,
      rewardRate: params.rewardRate,
      redemptionRate: params.redemptionRate,
      expectedRedemptionRatio: params.expectedRedemptionRatio,
      coverageDays: params.coverageDays,
      mobility: params.mobility,
      disputedShare: params.disputedShare,
      packageScale: params.packageScale,
    },
    series,
    segments,
    segments_note:
      "El error por segmento se informa pero no decide el veredicto: con pocos afiliados por celda es ruidoso.",
    concentration,
    observed: obs,
    simulated: {
      redeemed: history.map((h) => h.served),
      unmet_economic: history.map((h) => h.unmetEcosystem),
      outstanding: history.map((h) => h.outstanding),
      circulating: history.map((h) => h.C),
      treasury: history.map((h) => h.T),
    },
    reconciliation: {
      checks: sim.checks,
      failures: sim.failures.length,
      fifo_violations: sim.summary.priorityViolations,
    },
    disclaimer: DISCLAIMER,
    note: temporal
      ? "Calibración en A y evaluación en B con exports as-of. Series de estado no comparables sin inyección de estado."
      : "Modo en muestra: los parámetros ven la misma ventana que se evalúa. Cota optimista, no validación.",
  };
}
