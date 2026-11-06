/**
 * Snapshot de validación: el objeto único que consume el panel GOD.
 * No toca producción ni DB: se construye a partir de un dataset exportado.
 */

import { runBacktest } from "./backtest.mjs";
import { datasetHash, runPipelineAudit } from "./pipeline-audit.mjs";
import { SPEC_VERSION, runValidation } from "./real-data-spec.mjs";

export const SNAPSHOT_VERSION = "1.0";

/** Compuertas de decisión. Estado estático, editable a mano cuando cambie. */
export const DECISIONS = [
  { id: "G1", label: "Contratos canónicos de pago (RP-0)", status: "hecho", owner: "tech" },
  { id: "G2", label: "Shadow mode sin discrepancias", status: "en-curso", owner: "tech" },
  { id: "G3", label: "¿Una obligación fiat se extingue entregando Bunz?", status: "pendiente", owner: "negocio+legal" },
  { id: "G4", label: "Paridad Bunz–MXN y su mecanismo", status: "pendiente", owner: "negocio+CFO" },
  { id: "G5", label: "Límite contractual de autorización", status: "pendiente", owner: "negocio" },
  { id: "G6", label: "Política de concentración y remedios", status: "pendiente", owner: "negocio" },
  { id: "G7", label: "orders.bunzPaid con semántica única", status: "en-curso", owner: "producto+tech" },
  { id: "G8", label: "Datos reales que respalden el modelo", status: "pendiente", owner: "datos" },
  { id: "G9", label: "Aprobación explícita de RP-2", status: "pendiente", owner: "gobernanza" },
];

const H = (report) => datasetHash(report);

/** Plan de trabajo vivo. Estado estático: se edita cuando cambie una OT. */
export const ROADMAP = [
  { id: "OT-8", label: "Unidades, agregación y conciliación (R24–R26)", status: "hecho" },
  { id: "OT-7", label: "Bitemporalidad y reconstrucción as-of", status: "hecho" },
  { id: "OT-6", label: "Protocolo temporal por defecto", status: "hecho" },
  { id: "OT-1", label: "Redenciones con motivo (no atendido)", status: "pendiente" },
  { id: "OT-4", label: "Snapshot diario de capacidad", status: "pendiente" },
  { id: "OT-3", label: "Libro Bunz de doble entrada", status: "pendiente" },
  { id: "OT-2", label: "Obligaciones con ciclo de vida", status: "pendiente" },
  { id: "OT-5", label: "Señales de abuso", status: "pendiente" },
  { id: "OT-9", label: "Dual-run / sombra y cobertura", status: "pendiente" },
];

/** Alertas deterministas: lo que exige atención esta semana. */
export function buildAlerts({ validation, audit, backtest }) {
  const out = [];
  const push = (code, severity, message) => out.push({ code, severity, message });

  if (validation.errors.length > 0) {
    push("ALR-01", "alto", `${validation.errors.length} error(es) de contrato`);
  }
  if (!validation.calibration_ready) {
    push("ALR-02", "info", "no calibrable (es el estado esperado del piloto)");
  }
  const unmet = validation.metrics.unmet_economic_bunz ?? 0;
  if (unmet > 0) {
    push("ALR-03", "medio", `demanda no atendida: ${Math.round(unmet)} Bunz`);
  }
  const missing = validation.pilot?.datasets_missing ?? [];
  if (missing.length > 0) {
    push("ALR-04", "medio", `faltan ${missing.length} dataset(s): ${missing.join(", ")}`);
  }
  if (validation.meta?.unit_policy && validation.meta.unit_policy.approved !== true) {
    push("ALR-05", "medio", "paridad Bunz–MXN no aprobada (R24)");
  }
  if (validation.calibration_ready && backtest?.skipped) {
    push("ALR-06", "alto", "calibrable pero backtest no ejecutado");
  }
  if (audit.determinism === false) {
    push("ALR-07", "alto", "la auditoría no es determinista");
  }
  return out;
}

/** Checklist del viernes, calculada desde el snapshot (no se inventa nada). */
export function buildChecklist({ validation, audit, backtest, decisions }) {
  const rows = Object.values(validation.counts.datasets || {}).reduce((a, x) => a + x, 0);
  const errors = validation.errors.length;
  const pendientes = decisions.filter((d) => d.status === "pendiente").length;
  const backtestRan = backtest && !backtest.skipped;
  const outsideSample = backtestRan ? backtest.in_sample === false : false;

  return [
    { id: "export", label: "Export generado", ok: rows > 0, detail: `${rows} filas` },
    { id: "valid", label: "Dataset válido", ok: validation.ok, detail: validation.ok ? "sin errores" : "revisar" },
    { id: "errors", label: "Sin errores de contrato", ok: errors === 0, detail: `${errors} error(es)` },
    {
      id: "coverage",
      label: "Cobertura declarada",
      ok: validation.pilot ? validation.pilot.datasets_missing.length < 10 : validation.coverage.insufficient_cells.length === 0,
      detail: validation.pilot
        ? `${validation.pilot.datasets_present.length}/10 datasets`
        : `${validation.coverage.active_affiliates} activos`,
    },
    { id: "recon", label: "Auditoría determinista", ok: Boolean(audit.determinism), detail: audit.determinism ? "OK" : "FALLA" },
    {
      id: "backtest",
      label: "Backtest fuera de muestra",
      ok: outsideSample,
      detail: backtestRan ? (backtest.in_sample ? "en muestra" : "OK") : "no ejecutado",
    },
    {
      id: "calibration",
      label: "Calibrable",
      ok: validation.calibration_ready,
      detail: validation.calibration_ready ? "listo" : "bloqueado",
    },
    {
      id: "decisions",
      label: "Compuertas sin pendientes",
      ok: pendientes === 0,
      detail: `${pendientes} pendiente(s)`,
    },
  ];
}

function nextStep(validation, audit) {
  if (!validation.ok) return "corregir los errores del dataset antes de seguir";
  if (validation.pilot) {
    const gaps = validation.pilot.datasets_missing;
    return gaps.length
      ? `piloto: instrumentar ${gaps.join(", ")}`
      : "piloto: ampliar a ≥5 afiliados por celda y 12 semanas";
  }
  if (!validation.calibration_ready) return "faltan metadatos o cobertura para calibrar";
  if (audit.verdict === "hallazgos") return "resolver hallazgos de la auditoría";
  return "listo para discutir el modelo (no aprobado)";
}

export function buildSnapshot(dataset, { generatedAt, sourceCommit, exportId } = {}) {
  const validation = runValidation(dataset);
  const audit = runPipelineAudit(dataset);
  const hash = datasetHash(dataset);

  const backtest = validation.calibration_ready
    ? runBacktest(dataset)
    : { skipped: true, reason: "dataset no calibrable (piloto, cobertura o metadatos)" };

  const checklist = buildChecklist({ validation, audit, backtest, decisions: DECISIONS });
  const alerts = buildAlerts({ validation, audit, backtest });

  return {
    snapshot_version: SNAPSHOT_VERSION,
    export_id: exportId ?? `exp-${hash.slice(0, 12)}`,
    generated_at: generatedAt ?? new Date().toISOString(),
    source_commit: sourceCommit ?? null,
    dataset_kind: dataset.dataset_kind ?? "real-export",
    dataset_hash: hash,
    spec_version: SPEC_VERSION,
    status: {
      valid: validation.ok,
      calibration_ready: validation.calibration_ready,
      audit_verdict: audit.verdict,
      next_step: nextStep(validation, audit),
    },
    counts: validation.counts.datasets,
    coverage: {
      active_affiliates: validation.coverage.active_affiliates,
      inactive_affiliates: validation.coverage.inactive_affiliates,
      cells: validation.coverage.cells,
      insufficient_cells: validation.coverage.insufficient_cells,
      sample_top3_sales_share: validation.coverage.sample_top3_sales_share,
      limitations: validation.coverage.limitations,
    },
    pilot: validation.pilot,
    metrics: validation.metrics,
    rules: {
      errors: validation.errors,
      warnings: validation.warnings,
      not_checked: validation.pilot?.rules_not_checked ?? [],
    },
    backtest: validation.calibration_ready
      ? {
          verdict: backtest.verdict,
          in_sample: backtest.in_sample,
          failed_checks: backtest.failed_checks,
          series: backtest.series,
          calibration: backtest.calibration,
          evaluation: backtest.evaluation,
        }
      : backtest,
    audit: {
      verdict: audit.verdict,
      manifest_hash: audit.manifest.manifest_hash,
      fingerprint: audit.fingerprint.fingerprint,
      determinism: audit.determinism.identical,
      findings: audit.findings,
      leakage_mitigated: audit.leakage.every((l) => l.mitigated),
    },
    decisions: DECISIONS,
    roadmap: ROADMAP,
    checklist,
    alerts,
    artifacts: {
      validation_hash: H(validation),
      audit_hash: audit.fingerprint.fingerprint,
      backtest_hash: validation.calibration_ready ? H(backtest) : null,
    },
  };
}
