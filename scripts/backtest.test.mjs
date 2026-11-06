import test from "node:test";
import assert from "node:assert/strict";
import { makeSample } from "./fixtures/make-real-data-sample.mjs";
import { computeMetrics } from "./lib/real-data-spec.mjs";
import {
  THRESHOLDS,
  compareSeries,
  deriveParameters,
  observedMonthly,
  runBacktest,
} from "./lib/backtest.mjs";

const base = () => JSON.parse(JSON.stringify(makeSample()));

// ── Matemática de comparación ───────────────────────────────────────────────

test("compareSeries: series idénticas dan error cero", () => {
  const r = compareSeries([10, 20, 30], [10, 20, 30]);
  assert.equal(r.mape, 0);
  assert.equal(r.mae, 0);
  assert.equal(r.bias, 0);
  assert.equal(r.n, 3);
});

test("compareSeries: MAPE, MAE y sesgo correctos", () => {
  const r = compareSeries([100, 100], [110, 90]);
  assert.ok(Math.abs(r.mae - 10) < 1e-9);
  assert.ok(Math.abs(r.mape - 0.1) < 1e-9);
  assert.ok(Math.abs(r.bias) < 1e-9, "errores simétricos → sesgo 0");
});

test("compareSeries: sesgo negativo cuando el modelo subestima", () => {
  const r = compareSeries([100, 100], [80, 80]);
  assert.ok(Math.abs(r.bias + 20) < 1e-9);
  assert.ok(Math.abs(r.bias_pct + 0.2) < 1e-9);
  assert.ok(Math.abs(r.mape - 0.2) < 1e-9);
});

test("compareSeries: no divide por cero; informa meses usados en MAPE", () => {
  const r = compareSeries([0, 100], [0, 50]);
  assert.equal(r.mape, 0.5);
  assert.equal(r.mape_months, 1);
  assert.ok(Math.abs(r.mae - 25) < 1e-9);
});

test("compareSeries: recorta a la serie más corta", () => {
  const r = compareSeries([1, 2], [1, 2, 3, 4]);
  assert.equal(r.n, 2);
});

// ── Parámetros medidos ──────────────────────────────────────────────────────

test("deriveParameters: n, meses y participaciones coherentes", () => {
  const p = deriveParameters(base());
  assert.equal(p.n, 20, "20 afiliados activos con ventas");
  assert.equal(p.months, 3, "ventana operativa ene-mar");
  assert.ok(Math.abs(p.demand.reduce((a, x) => a + x, 0) - 1) < 1e-9);
  assert.ok(Math.abs(p.capacity.reduce((a, x) => a + x, 0) - 1) < 1e-9);
  assert.ok(Math.abs(p.redemption.reduce((a, x) => a + x, 0) - 1) < 1e-9);
  assert.equal(p.fiatSeries.length, 3);
  assert.ok(p.rewardRate > 0 && p.rewardRate <= 1);
  assert.ok(p.redemptionRate >= 0.05 && p.redemptionRate <= 1);
  assert.ok(p.mobility > 0 && p.mobility < 1);
});

// ── Series observadas ───────────────────────────────────────────────────────

test("observedMonthly: las series cuadran con las métricas del contrato", () => {
  const data = base();
  const metrics = computeMetrics(data);
  const obs = observedMonthly(data);

  assert.equal(obs.months.length, 3);
  assert.ok(Math.abs(obs.redeemed.reduce((a, x) => a + x, 0) - metrics.redeemed_bunz) < 0.01);
  assert.ok(Math.abs(obs.unmet_economic.reduce((a, x) => a + x, 0) - metrics.unmet_economic_bunz) < 0.01);
  assert.ok(obs.outstanding.at(-1) >= 0);
  assert.ok(obs.circulating.at(-1) >= 0);
  assert.ok(obs.treasury.at(-1) >= 0);
});

test("observedMonthly: la concentración observada se calcula sobre capacidad", () => {
  const obs = observedMonthly(base());
  assert.ok(obs.concentration.total > 0);
  assert.ok(obs.concentration.top1 > 0 && obs.concentration.top1 <= 1);
  assert.ok(obs.concentration.top3 >= obs.concentration.top1);
  const catSum = Object.values(obs.concentration.by_category).reduce((a, x) => a + x, 0);
  assert.ok(Math.abs(catSum - 1) < 1e-9);
});

// ── Backtest ────────────────────────────────────────────────────────────────

test("runBacktest: el fixture sintético NO debe declararse buen ajuste", () => {
  // El fixture se generó con otro proceso: si el backtest lo declarara
  // «aceptable», el harness estaría midiendo mal.
  const r = runBacktest(base());
  assert.equal(r.verdict, "ajuste-debil");
  assert.ok(r.failed_checks.length > 0);
  assert.equal(r.verdict === "aprobado", false);
});

test("runBacktest: siempre incluye disclaimer y nunca «aprobado»", () => {
  const r = runBacktest(base());
  assert.ok(r.disclaimer.includes("NO aprueba"));
  assert.notEqual(r.verdict, "aprobado");
  assert.ok(["ajuste-aceptable", "ajuste-debil", "no-apto"].includes(r.verdict));
});

test("runBacktest: dataset inválido → no-apto, no calibra", () => {
  const data = base();
  data.redemptions.push({ ...data.redemptions[0] });
  const r = runBacktest(data);
  assert.equal(r.verdict, "no-apto");
  assert.ok(r.reason.includes("contrato"));
  assert.ok(r.errors.length > 0);
});

test("runBacktest: cobertura insuficiente → no-apto, no extrapola", () => {
  const data = base();
  const target = data.affiliates.find((a) => a.status === "active" && a.category === "food" && a.size_band === "S");
  target.status = "inactive";
  const r = runBacktest(data);
  assert.equal(r.verdict, "no-apto");
  assert.ok(r.reason.includes("cobertura"));
  assert.ok(r.coverage.limitations.length > 0);
});

test("runBacktest: la reconciliación del modelo se reporta junto al ajuste", () => {
  const r = runBacktest(base());
  assert.equal(r.reconciliation.failures, 0);
  assert.equal(r.reconciliation.fifo_violations, 0);
  assert.ok(r.reconciliation.checks > 0);
});

test("runBacktest: umbrales preliminares expuestos y no alterados", () => {
  const r = runBacktest(base());
  assert.deepEqual(r.thresholds, THRESHOLDS);
  assert.equal(r.thresholds.mape_max, 0.25);
});

test("runBacktest: sin meses suficientes → no-apto", () => {
  const data = base();
  // con min_months=6 y solo 3 meses operativos, no se calibra
  const r = runBacktest(data, { thresholds: { ...THRESHOLDS, min_months: 6 } });
  assert.equal(r.verdict, "no-apto");
  assert.ok(r.reason.includes("ventana"));
});

// ── Series por afiliado y error por segmento ────────────────────────────────

import { run } from "./economy-sim-v2323.mjs";
import { observedBySegment, simulatedBySegment } from "./lib/backtest.mjs";

test("por afiliado: la serie suma exactamente el agregado del mes", () => {
  const r = run({ label: "n3", n: 3, months: 2, byBusiness: true });
  for (const h of r.history) {
    const served = h.byBusiness.reduce((a, b) => a + b.served, 0);
    const unmet = h.byBusiness.reduce((a, b) => a + b.unmet, 0);
    // Los valores van redondeados por afiliado (presentación): el agregado
    // puede diferir en ±n unidades por redondeo, no por economía.
    assert.ok(Math.abs(served - h.served) <= h.byBusiness.length);
    assert.ok(Math.abs(unmet - h.unmetEcosystem) <= h.byBusiness.length);
    assert.equal(h.byBusiness.length, 3);
  }
});

test("por afiliado: desactivado por defecto (sin cambios en la salida)", () => {
  const r = run({ label: "defecto" });
  assert.equal(r.history[0].byBusiness, undefined);
});

test("segmentos: observado y simulado suman el total agregado", () => {
  const data = base();
  const months = observedMonthly(data).months;
  const obsSeg = observedBySegment(data, months);
  const totalObs = [...obsSeg.values()].reduce((a, s) => a + s.redeemed.reduce((x, y) => x + y, 0), 0);
  const metrics = computeMetrics(data);
  assert.ok(Math.abs(totalObs - metrics.redeemed_bunz) < 0.01);

  const r = runBacktest(data);
  const totalSim = r.segments.reduce((a, s) => a + s.redeemed.simulated_mean * s.redeemed.n, 0);
  const simTotal = r.simulated.redeemed.reduce((a, x) => a + x, 0);
  const tolRound = r.segments.length * r.observed.redeemed.length;
  assert.ok(Math.abs(totalSim - simTotal) <= tolRound, `segmentos ${totalSim} vs total ${simTotal}`);
});

test("segmentos: cuatro celdas categoría × tamaño, con nota de lectura", () => {
  const r = runBacktest(base());
  assert.equal(r.segments.length, 4);
  assert.deepEqual(r.segments.map((s) => s.segment), ["coffee|M", "coffee|S", "food|M", "food|S"]);
  assert.ok(r.segments_note.includes("no decide el veredicto"));
  assert.equal(r.verdict, "ajuste-debil", "los segmentos no alteran el veredicto");
});

test("segmentos: un segmento sin observaciones no rompe la comparación", () => {
  const data = base();
  const months = observedMonthly(data).months;
  const obs = observedBySegment(data, months);
  const fakeHistory = [{ byBusiness: [{ id: 0, category: "nueva", served: 10, unmet: 0 }] }];
  const sim = simulatedBySegment(fakeHistory, [{ id: 0, category: "nueva", size_band: "S" }]);
  assert.equal(sim.get("nueva|S").redeemed[0], 10);
  assert.equal(obs.get("nueva|S"), undefined);
});

// ── OT-6 · Partición temporal por defecto ───────────────────────────────────

test("OT-6: el modo por defecto es temporal y se declara in_sample:false", () => {
  const r = runBacktest(base());
  assert.equal(r.mode, "temporal");
  assert.equal(r.in_sample, false);
  assert.ok(r.calibration.months.length > 0);
  assert.ok(r.evaluation.months.length > 0);
  assert.match(r.calibration.export_hash, /^[0-9a-f]{64}$/);
  assert.match(r.evaluation.export_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(r.non_comparable_series, ["outstanding_bunz", "circulating_bunz", "treasury_bunz"]);
});

test("OT-6: los parámetros salen solo de A", () => {
  const r = runBacktest(base());
  assert.equal(r.parameters.months, r.calibration.months.length);
  assert.equal(r.params_source, `calibración as-of ${r.calibration.cut}`);
});

test("OT-6: un evento en B no cambia los parámetros de A ni el export de calibración", () => {
  const a = runBacktest(base());

  const conEvento = base();
  conEvento.sales.push({
    id: "s-marzo-nuevo",
    affiliate_id: "a01",
    ts: "2026-03-20T12:00:00Z",
    gross_mxn: 50_000,
    discount_bunz: 2500,
    tickets: 10,
    user: "u-nuevo",
  });

  const b = runBacktest(conEvento);
  assert.deepEqual(b.calibration.params, a.calibration.params, "A no se contamina con B");
  assert.equal(b.calibration.export_hash, a.calibration.export_hash);
  assert.notEqual(b.evaluation.export_hash, a.evaluation.export_hash, "B sí cambia");
});

test("OT-6: el modo en muestra se marca explícitamente", () => {
  const r = runBacktest(base(), { mode: "in_sample" });
  assert.equal(r.mode, "in_sample");
  assert.equal(r.in_sample, true);
  assert.ok(r.series.outstanding_bunz, "en muestra sí compara series de estado");
  assert.ok(r.note.includes("Cota optimista"));
});
