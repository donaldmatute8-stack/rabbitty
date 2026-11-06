import test from "node:test";
import assert from "node:assert/strict";
import { makeSample } from "./fixtures/make-real-data-sample.mjs";
import {
  checkDeterminism,
  datasetHash,
  diagnose,
  leakageFindings,
  parameterProvenance,
  readManifest,
  runPipelineAudit,
  runTemporalBacktest,
  temporalFeasibility,
} from "./lib/pipeline-audit.mjs";
import { runBacktest } from "./lib/backtest.mjs";

const base = () => JSON.parse(JSON.stringify(makeSample()));

// ── 1. Reproducibilidad ─────────────────────────────────────────────────────

test("reproducibilidad: el manifiesto lista artefactos con hash y es estable", () => {
  const a = readManifest();
  const b = readManifest();
  assert.ok(a.artifacts.length >= 5);
  for (const art of a.artifacts) {
    assert.match(art.sha256, /^[0-9a-f]{64}$/);
    assert.ok(art.bytes > 0);
  }
  assert.equal(a.manifest_hash, b.manifest_hash, "dos lecturas → mismo hash");
  assert.equal(a.spec_version, "1.0.0");
});

test("reproducibilidad: el hash del dataset es estable y sensible a cambios", () => {
  const data = base();
  assert.equal(datasetHash(data), datasetHash(base()));
  const mutated = base();
  mutated.sales[0].gross_mxn += 1;
  assert.notEqual(datasetHash(mutated), datasetHash(data));
});

test("reproducibilidad: misma entrada produce la misma salida", () => {
  const r = checkDeterminism(base());
  assert.equal(r.identical, true);
  assert.match(r.hash, /^[0-9a-f]{64}$/);
  assert.equal(r.runs, 2);
});

// ── 2. Independencia ────────────────────────────────────────────────────────

test("independencia: entradas exógenas marcadas como independientes", () => {
  const prov = parameterProvenance();
  const by = Object.fromEntries(prov.map((p) => [p.parameter, p]));
  for (const k of ["n", "months", "demand", "capacity", "redemption", "fiatSeries"]) {
    assert.equal(by[k].independent, true, k);
    assert.equal(by[k].source, "exogeno");
  }
});

test("independencia: parámetros calibrados sobre la salida se detectan como fuga", () => {
  const leakage = leakageFindings();
  const names = leakage.map((l) => l.parameter).sort();
  assert.deepEqual(names, ["disputedShare", "expectedRedemptionRatio", "mobility", "redemptionRate", "rewardRate"]);
  for (const l of leakage) {
    assert.equal(l.code, "LKG-01");
    assert.equal(l.severity, "alto");
    assert.ok(l.fix.length > 0);
  }
});

test("independencia: la fuga se reporta y queda mitigada por partición temporal", () => {
  const audit = runPipelineAudit(base());
  assert.ok(audit.leakage.length > 0);
  assert.equal(audit.verdict, "hallazgos", "quedan hallazgos medios (estado)");
  assert.ok(audit.leakage.every((l) => l.mitigated === true));
  assert.ok(audit.leakage.every((l) => l.severity === "info"));
  assert.equal(audit.backtest.in_sample, false, "la evaluación es fuera de muestra");
  assert.ok(audit.backtest.calibration.export_hash);
  assert.ok(audit.backtest.evaluation.export_hash);
});

// ── 3. Validación temporal ─────────────────────────────────────────────────

test("temporal: detecta meses disponibles y propone split", () => {
  const t = temporalFeasibility(base());
  assert.deepEqual(t.months, ["2026-01", "2026-02", "2026-03"]);
  assert.equal(t.possible, true);
  assert.ok(t.suggested_split.calibration.length >= 1);
  assert.ok(t.suggested_split.evaluation.length >= 1);
  assert.equal(t.full_state_validation, false);
  assert.ok(t.blocking_requirements.length > 0);
});

test("temporal: calibra en A y evalúa en B, declarando el reinicio de estado", () => {
  const r = runTemporalBacktest(base());
  assert.equal(r.ok, true);
  assert.equal(r.params_from, "calibración");
  assert.equal(r.evaluated_on, "evaluación");
  assert.equal(r.state_reset, true);
  assert.deepEqual(r.comparable_series, ["redeemed_bunz", "unmet_economic_bunz"]);
  assert.ok(r.non_comparable_series.includes("treasury_bunz"));
  assert.ok(r.warning.includes("estado se reinicia"));
  for (const s of Object.values(r.series)) assert.ok(s.n >= 1);
});

test("temporal: ventana de un solo mes no permite separar", () => {
  const data = base();
  data.window.operational = { from: "2026-01-01", to: "2026-01-31" };
  const r = runTemporalBacktest(data);
  assert.equal(r.ok, false);
});

// ── 4. Trazabilidad ────────────────────────────────────────────────────────

test("trazabilidad: cada discrepancia tiene hipótesis, evidencia y próximo chequeo", () => {
  const report = runBacktest(base());
  const d = diagnose(report);
  assert.ok(d.length >= 2);
  for (const item of d) {
    assert.ok(item.series);
    assert.ok(item.hypothesis.length > 20);
    assert.ok(item.evidence && typeof item.evidence === "object");
    assert.ok(item.next_check.length > 10);
    assert.ok(item.status.includes("hipótesis"));
  }
});

test("trazabilidad: no diagnostica un dataset no apto", () => {
  assert.deepEqual(diagnose({ verdict: "no-apto" }), []);
});

// ── Veredicto ──────────────────────────────────────────────────────────────

test("auditoría: nunca declara «aprobado» e incluye los cuatro controles", () => {
  const a = runPipelineAudit(base());
  assert.notEqual(a.verdict, "aprobado");
  assert.equal(a.never, "aprobado");
  assert.ok(a.manifest && a.determinism && a.provenance && a.temporal && a.backtest && a.diagnosis);
  assert.ok(a.disclaimer.includes("NO aprueba"));
});

test("auditoría: dataset no apto produce hallazgo de severidad alta", () => {
  const data = base();
  data.redemptions.push({ ...data.redemptions[0] });
  const a = runPipelineAudit(data);
  assert.ok(a.findings.some((f) => f.code === "FIT-02" && f.severity === "alto"));
  assert.equal(a.verdict, "hallazgos");
});
