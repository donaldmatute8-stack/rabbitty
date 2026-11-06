/**
 * ── Auditoría del pipeline de validación ────────────────────────────────────
 * Cuatro controles antes de conectar datos reales:
 *  1. Independencia de datos (¿se evalúa con lo mismo que se calibró?)
 *  2. Reproducibilidad (versiones, hashes, determinismo)
 *  3. Validación temporal (calibrar en A, evaluar en B)
 *  4. Trazabilidad de discrepancias (cada error → variable/regla/hipótesis)
 *
 * NO aprueba nada. Emite "auditoria-ok" o "hallazgos".
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "../economy-sim-v2323.mjs";
import { SPEC_VERSION, computeMetrics } from "./real-data-spec.mjs";
import {
  DISCLAIMER,
  THRESHOLDS,
  compareSeries,
  deriveParameters,
  observedMonthly,
  runBacktest,
} from "./backtest.mjs";

const EPS = 1e-9;
const sum = (xs) => xs.reduce((a, x) => a + x, 0);
const monthOf = (d) => String(d).slice(0, 7);

// ── Canonicalización y hashes ───────────────────────────────────────────────

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

export function datasetHash(dataset) {
  return sha256(canonical(dataset));
}

export const ARTIFACTS = [
  "scripts/lib/economy-v2322.mjs",
  "scripts/economy-sim-v2323.mjs",
  "scripts/lib/real-data-spec.mjs",
  "scripts/lib/real-data-csv.mjs",
  "scripts/lib/backtest.mjs",
  "scripts/lib/asof.mjs",
  "scripts/lib/pipeline-audit.mjs",
  "scripts/real-data-validate.mjs",
  "scripts/real-data-csv.mjs",
  "scripts/asof-export.mjs",
  "scripts/backtest-run.mjs",
  "scripts/pipeline-audit.mjs",
  "scripts/real-data-spec.test.mjs",
  "scripts/real-data-csv.test.mjs",
  "scripts/asof.test.mjs",
  "scripts/backtest.test.mjs",
  "scripts/pipeline-audit.test.mjs",
];

export function readManifest() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const artifacts = ARTIFACTS.map((rel) => {
    const path = `${root}${rel}`;
    const text = fs.readFileSync(path, "utf8");
    return { path: rel, bytes: Buffer.byteLength(text), sha256: sha256(text) };
  });
  return {
    spec_version: SPEC_VERSION,
    node: process.version,
    generated_by: "pipeline-audit v1.0",
    artifacts,
    manifest_hash: sha256(artifacts.map((a) => `${a.path}:${a.sha256}`).join("|")),
  };
}

// ── 1. Independencia: procedencia de cada parámetro ─────────────────────────

export const PROVENANCE = {
  // entradas exógenas: no dependen del resultado que se va a evaluar
  n: { source: "exogeno", independent: true },
  months: { source: "exogeno", independent: true },
  demand: { source: "exogeno", independent: true },
  capacity: { source: "exogeno", independent: true },
  redemption: { source: "exogeno", independent: true },
  fiatSeries: { source: "exogeno", independent: true },
  // derivados de la operación pero no del resultado evaluado
  coverageDays: { source: "calibrado-entrada", independent: true },
  packageScale: { source: "escala", independent: true },
  // estimados sobre la MISMA serie que luego se evalúa → riesgo de circularidad
  rewardRate: { source: "calibrado-salida", independent: false },
  redemptionRate: { source: "calibrado-salida", independent: false },
  expectedRedemptionRatio: { source: "calibrado-salida", independent: false },
  mobility: { source: "calibrado-salida", independent: false },
  disputedShare: { source: "calibrado-salida", independent: false },
};

export function parameterProvenance() {
  return Object.entries(PROVENANCE).map(([name, meta]) => ({ parameter: name, ...meta }));
}

export function leakageFindings(report = null) {
  const mitigated = Boolean(report && report.in_sample === false);
  return parameterProvenance()
    .filter((p) => !p.independent)
    .map((p) => ({
      code: "LKG-01",
      parameter: p.parameter,
      severity: mitigated ? "info" : "alto",
      mitigated,
      msg: mitigated
        ? `'${p.parameter}' se estima solo en la ventana de calibración; la evaluación ocurre en otra ventana as-of. Mitigado, aunque sigue siendo estimación a partir de resultados observados.`
        : `'${p.parameter}' se estima sobre la serie observada y luego se usa para predecirla: la comparación es en muestra.`,
      fix: "medirlo con fuente independiente (encuesta de movilidad, política de disputas) cuando exista; mientras tanto, la partición temporal es el mínimo exigible.",
    }));
}

// ── 2. Reproducibilidad ─────────────────────────────────────────────────────

export function checkDeterminism(dataset, { runs = 2 } = {}) {
  const outputs = [];
  for (let i = 0; i < runs; i++) outputs.push(JSON.stringify(runBacktest(dataset)));
  const identical = outputs.every((o) => o === outputs[0]);
  return {
    runs,
    identical,
    hash: sha256(outputs[0]),
    note: identical
      ? "misma entrada → misma salida byte a byte"
      : "NO determinista: el resultado no puede reproducirse",
  };
}

export function pipelineFingerprint(dataset) {
  const params = deriveParameters(dataset);
  const report = runBacktest(dataset);
  return {
    dataset_hash: datasetHash(dataset),
    spec_version: SPEC_VERSION,
    parameters_hash: sha256(canonical(params)),
    report_hash: sha256(canonical(report)),
    fingerprint: sha256(
      canonical({
        dataset: datasetHash(dataset),
        spec: SPEC_VERSION,
        params: params,
        report,
      })
    ),
  };
}

// ── 3. Validación temporal ──────────────────────────────────────────────────

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

export function temporalFeasibility(dataset) {
  const months = monthsBetween(dataset.window.operational.from, dataset.window.operational.to);
  const k = Math.max(1, Math.ceil(months.length * 0.66));
  return {
    months,
    possible: months.length >= 3,
    suggested_split: { calibration: months.slice(0, k), evaluation: months.slice(k) },
    full_state_validation: false,
    flow_only_series: ["redeemed_bunz", "unmet_economic_bunz"],
    blocking_requirements: [
      "inyección de estado inicial (circulación, tesorería Bunz, stock, obligaciones abiertas)",
      "el modelo no acepta obligaciones externas ni saldos de apertura",
    ],
    note: "Sin estado inicial solo se pueden evaluar series de flujo; deuda, circulación y tesorería no son comparables fuera de la ventana de calibración.",
  };
}

function sliceByMonths(dataset, months) {
  const keep = (d) => d != null && months.includes(String(d).slice(0, 7));
  return {
    ...dataset,
    window: {
      ...dataset.window,
      operational: { from: `${months[0]}-01`, to: `${months.at(-1)}-28` },
      financial: { from: dataset.window.financial.from, to: `${months.at(-1)}-28` },
    },
    sales: (dataset.sales || []).filter((s) => keep(s.ts)),
    rewards_issued: (dataset.rewards_issued || []).filter((r) => keep(r.ts)),
    redemptions: (dataset.redemptions || []).filter((r) => keep(r.requested_at)),
    capacity: (dataset.capacity || []).filter((c) => keep(c.date)),
    obligations: (dataset.obligations || []).filter((o) => keep(o.accrued_at)),
    fiat_settlements: (dataset.fiat_settlements || []).filter((f) => keep(f.received_at)),
    treasury: (dataset.treasury || []).filter((t) => keep(t.date)),
    bunz_ledger: (dataset.bunz_ledger || []).filter((e) => keep(e.ts)),
  };
}

export function runTemporalBacktest(dataset, { splitIndex } = {}) {
  const r = runBacktest(dataset, { mode: "temporal", splitIndex });
  if (r.verdict === "no-apto") {
    return { ok: false, reason: r.reason, feasibility: temporalFeasibility(dataset) };
  }
  return {
    ok: true,
    split: { calibration: r.calibration.months, evaluation: r.evaluation.months },
    params_from: "calibración",
    evaluated_on: "evaluación",
    state_reset: true,
    comparable_series: Object.keys(r.series),
    non_comparable_series: r.non_comparable_series,
    series: r.series,
    warning:
      "El estado se reinicia en 0 al inicio de la evaluación: solo las series de flujo son comparables. " +
      "Para comparar deuda, circulación y tesorería hace falta inyección de estado.",
  };
}

// ── 4. Trazabilidad de discrepancias ────────────────────────────────────────

export function diagnose(report) {
  if (!report || report.verdict === "no-apto") return [];
  const out = [];
  const add = (series, hypothesis, evidence, next_check) =>
    out.push({ series, hypothesis, evidence, next_check });

  const s = report.series;
  const failed = (name, threshold = THRESHOLDS.mape_max) =>
    s[name] && s[name].mape !== null && s[name].mape > threshold;

  if (failed("redeemed_bunz")) {
    add(
      "redeemed_bunz",
      "La tasa de redención se calibra como media de la propia serie observada; si la demanda es estacional, la media subestima los picos.",
      { mape: s.redeemed_bunz.mape, bias: s.redeemed_bunz.bias, observed_mean: s.redeemed_bunz.observed_mean, simulated_mean: s.redeemed_bunz.simulated_mean },
      "reestimar redemptionRate por mes (no como media) y repetir en ventana temporal separada."
    );
  }
  if (failed("unmet_economic_bunz")) {
    add(
      "unmet_economic_bunz",
      "El modelo no genera demanda no atendida: la capacidad disponible supera lo solicitado. La causa está en la holgura de capacidad (coverageDays/packageScale) o en la tasa de redención calibrada.",
      { mape: s.unmet_economic_bunz.mape, observed_mean: s.unmet_economic_bunz.observed_mean, simulated_mean: s.unmet_economic_bunz.simulated_mean },
      "comparar capacidad autorizada vs solicitada mes a mes; verificar si el no atendido observado coincide con meses de capacidad consumida al 100%."
    );
  }
  if (failed("treasury_bunz", THRESHOLDS.mape_max_debt)) {
    add(
      "treasury_bunz",
      "La tesorería del modelo solo acumula liquidaciones; el snapshot observado incluye fondeo/aportes (asientos con contrapartida 'external').",
      { mape: s.treasury_bunz.mape, bias: s.treasury_bunz.bias },
      "separar en el dataset tesorería por origen (liquidaciones vs aportes) y volver a comparar solo la parte de liquidaciones."
    );
  }
  if (failed("circulating_bunz", THRESHOLDS.mape_max_debt)) {
    add(
      "circulating_bunz",
      "La circulación depende de emisión y redención: un sesgo negativo indica que el modelo emite menos o redime más que la operación.",
      { mape: s.circulating_bunz.mape, bias: s.circulating_bunz.bias },
      "contrastar rewardRate observado por mes contra el aplicado en el modelo."
    );
  }
  if ((report.non_comparable_series || []).length) {
    add(
      "series-de-estado",
      "Deuda, circulación y tesorería no se comparan: el modelo reinicia el estado en 0 al empezar la evaluación.",
      { non_comparable: report.non_comparable_series },
      "implementar inyección de estado inicial (OT-2/OT-3) y repetir la comparación."
    );
  }
  if (Math.abs(report.concentration?.delta_pp?.top3 ?? 0) > THRESHOLDS.concentration_pp_max) {
    add(
      "concentracion_top3",
      "La concentración simulada no reproduce la observada.",
      { delta_pp: report.concentration.delta_pp.top3 },
      "verificar que la distribución de capacidad usada como entrada sea la vigente al cierre y no la inicial."
    );
  }

  return out.map((d) => ({ ...d, status: "hipótesis a verificar, no conclusión" }));
}

// ── Orquestación ────────────────────────────────────────────────────────────

export function runPipelineAudit(dataset, { runs = 2 } = {}) {
  const manifest = readManifest();
  const determinism = checkDeterminism(dataset, { runs });
  const provenance = parameterProvenance();
  const temporal = temporalFeasibility(dataset);
  const report = runBacktest(dataset);
  const leakage = leakageFindings(report);
  const diagnosis = diagnose(report);
  const fingerprint = pipelineFingerprint(dataset);

  const findings = [];
  if (!determinism.identical) findings.push({ code: "REP-01", severity: "alto", msg: determinism.note });
  for (const l of leakage) findings.push(l);
  if (!temporal.possible) findings.push({ code: "TMP-01", severity: "medio", msg: "ventana insuficiente para validación temporal" });
  if (temporal.possible && !temporal.full_state_validation) {
    findings.push({
      code: "TMP-02",
      severity: "medio",
      msg: "validación temporal solo de flujos: deuda, circulación y tesorería no son comparables sin inyección de estado",
    });
  }
  if (report.verdict === "ajuste-debil") {
    findings.push({
      code: "FIT-01",
      severity: "info",
      msg: `ajuste débil en: ${report.failed_checks.join(", ")}`,
    });
  }
  if (report.verdict === "no-apto") {
    findings.push({ code: "FIT-02", severity: "alto", msg: `dataset no apto: ${report.reason}` });
  }
  if (diagnosis.length === 0 && report.verdict !== "no-apto") {
    findings.push({ code: "DIA-01", severity: "info", msg: "sin discrepancias por encima del umbral" });
  }

  return {
    spec_version: SPEC_VERSION,
    verdict: findings.some((f) => ["alto", "medio"].includes(f.severity))
      ? "hallazgos"
      : "auditoria-ok",
    never: "aprobado",
    manifest,
    fingerprint,
    determinism,
    provenance,
    leakage,
    temporal,
    backtest: {
      verdict: report.verdict,
      mode: report.mode ?? null,
      in_sample: report.in_sample ?? null,
      calibration: report.calibration ?? null,
      evaluation: report.evaluation ?? null,
      failed_checks: report.failed_checks ?? [],
      series: report.series ?? null,
      concentration: report.concentration ?? null,
    },
    diagnosis,
    findings,
    disclaimer: DISCLAIMER,
  };
}
