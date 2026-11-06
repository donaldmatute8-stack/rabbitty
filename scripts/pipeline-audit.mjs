#!/usr/bin/env node
/**
 * Auditoría del pipeline de validación (independencia + reproducibilidad).
 * Uso: node scripts/pipeline-audit.mjs <dataset.json> [--json]
 *
 * Verifica cuatro controles ANTES de conectar datos reales:
 *   1. independencia de datos (fuga de salidas a entradas)
 *   2. reproducibilidad (hashes, versiones, determinismo)
 *   3. validación temporal (calibrar en A, evaluar en B)
 *   4. trazabilidad de discrepancias
 *
 * Nunca emite "aprobado". Sale con código 1 si hay hallazgos de severidad alta.
 */

import fs from "node:fs";
import {
  readManifest,
  runPipelineAudit,
  runTemporalBacktest,
} from "./lib/pipeline-audit.mjs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("uso: node scripts/pipeline-audit.mjs <dataset.json> [--json]");
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(`no se pudo leer ${file}: ${err.message}`);
  process.exit(2);
}

const audit = runPipelineAudit(data);

if (args.includes("--json")) {
  console.log(JSON.stringify(audit, null, 2));
  process.exit(audit.verdict === "hallazgos" ? 1 : 0);
}

const pct = (x) => (x === null || x === undefined ? "n/d" : `${(x * 100).toFixed(1)}%`);
const num = (x) => (x === null || x === undefined ? "n/d" : Math.round(x).toLocaleString("en-US"));

console.log(`\nAUDITORÍA DEL PIPELINE — spec v${audit.spec_version}`);
console.log(`Dataset: ${file}`);
console.log(`Veredicto: ${audit.verdict}  (nunca «aprobado»)`);

console.log("\n── 1. Reproducibilidad ─────────────────────────────────────────");
console.log(`  node ${audit.manifest.node} | manifest ${audit.manifest.manifest_hash.slice(0, 16)}…`);
for (const a of audit.manifest.artifacts) {
  console.log(`  ${a.sha256.slice(0, 12)}…  ${String(a.bytes).padStart(7)} B  ${a.path}`);
}
console.log(`  determinismo: ${audit.determinism.identical ? "OK" : "FALLA"} (${audit.determinism.runs} ejecuciones)`);
console.log(`  salida:       ${audit.determinism.hash.slice(0, 16)}…`);
console.log(`  fingerprint:  ${audit.fingerprint.fingerprint.slice(0, 16)}…`);

console.log("\n── 2. Independencia de datos ──────────────────────────────────");
console.log("  parámetro                     procedencia        independiente");
for (const p of audit.provenance) {
  console.log(
    `  ${p.parameter.padEnd(28)} ${p.source.padEnd(18)} ${p.independent ? "sí" : "NO"}`
  );
}
if (audit.leakage.length) {
  const mitigadas = audit.leakage.every((l) => l.mitigated);
  console.log(
    `\n  ${mitigadas ? "Dependencias de calibración (MITIGADAS por partición temporal)" : "Fugas detectadas"}: ${audit.leakage.length}`
  );
  for (const l of audit.leakage) console.log(`   [${l.code}/${l.severity}] ${l.parameter}`);
  console.log(`   → ${audit.leakage[0].fix}`);
}

console.log("\n── 3. Validación temporal ─────────────────────────────────────");
const t = audit.temporal;
console.log(`  meses disponibles: ${t.months.join(", ")}`);
console.log(`  posible: ${t.possible ? "sí" : "no"} | split sugerido: ${t.suggested_split.calibration.join(",")} → ${t.suggested_split.evaluation.join(",")}`);
console.log(`  validación completa de estado: ${t.full_state_validation ? "sí" : "NO"}`);
for (const r of t.blocking_requirements) console.log(`   - requisito: ${r}`);
if (t.possible) {
  const temporal = runTemporalBacktest(data);
  if (temporal.ok) {
    console.log(`  ejecución parcial (solo flujos, estado reiniciado):`);
    for (const [k, v] of Object.entries(temporal.series)) {
      console.log(`    ${k.padEnd(24)} MAPE ${pct(v.mape)} · MAE ${num(v.mae)} · sesgo ${num(v.bias)}`);
    }
    console.log(`    ${temporal.warning}`);
  } else {
    console.log(`  no ejecutable: ${temporal.reason}`);
  }
}

console.log("\n── 4. Trazabilidad de discrepancias ───────────────────────────");
console.log(`  backtest: ${audit.backtest.verdict}${audit.backtest.failed_checks.length ? ` (${audit.backtest.failed_checks.join(", ")})` : ""}`);
if (!audit.diagnosis.length) console.log("  sin discrepancias por encima del umbral");
for (const d of audit.diagnosis) {
  console.log(`\n  · ${d.series}`);
  console.log(`    hipótesis: ${d.hypothesis}`);
  console.log(`    evidencia: ${JSON.stringify(d.evidence)}`);
  console.log(`    próximo chequeo: ${d.next_check}`);
  console.log(`    estado: ${d.status}`);
}

console.log("\n── Hallazgos ──────────────────────────────────────────────────");
for (const f of audit.findings) console.log(`  [${f.severity}] ${f.code}: ${f.msg}`);

console.log(`\n${audit.disclaimer}`);
process.exit(audit.verdict === "hallazgos" ? 1 : 0);
