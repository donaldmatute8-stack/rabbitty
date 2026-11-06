#!/usr/bin/env node
/**
 * Validador de datasets para BUNZ REAL DATA SPEC v1.0.
 * Uso:
 *   node scripts/real-data-validate.mjs <dataset.json>
 *   node scripts/real-data-validate.mjs <dataset.json> --json
 *   node scripts/real-data-validate.mjs <dataset.json> --backtest
 *
 * Código de salida: 0 válido · 1 inválido · 2 error de lectura.
 */

import fs from "node:fs";
import { runValidation, toBacktestInput } from "./lib/real-data-spec.mjs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("uso: node scripts/real-data-validate.mjs <dataset.json> [--json] [--backtest]");
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(`no se pudo leer ${file}: ${err.message}`);
  process.exit(2);
}

const report = runValidation(data);

if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\nBUNZ REAL DATA SPEC v${report.spec_version}`);
  console.log(`Dataset: ${file}`);
  console.log(`Válido: ${report.ok ? "SÍ" : "NO"} | errores: ${report.errors.length} | avisos: ${report.warnings.length}`);
  console.log(`Calibración habilitada: ${report.calibration_ready ? "SÍ" : "NO"}`);
  console.log(`\nFilas: ${JSON.stringify(report.counts.datasets)}`);

  if (report.errors.length) {
    console.log("\nErrores (bloquean calibración):");
    for (const e of report.errors.slice(0, 40)) console.log(`  [${e.code}] ${e.msg}`);
    if (report.errors.length > 40) console.log(`  … ${report.errors.length - 40} más`);
  }
  if (report.warnings.length) {
    console.log("\nAvisos (limitaciones declaradas):");
    for (const w of report.warnings.slice(0, 40)) console.log(`  [${w.code}] ${w.msg}`);
  }

  const m = report.metrics;
  console.log("\nMétricas reconstruidas desde eventos:");
  console.log(`  emitido:            ${m.emitted_bunz.toFixed(2)} Bunz`);
  console.log(`  redimido:          ${m.redeemed_bunz.toFixed(2)} Bunz`);
  console.log(`  circulación:       ${m.circulating_bunz.toFixed(2)} Bunz`);
  console.log(`  tesorería Bunz:    ${m.treasury_bunz.toFixed(2)} Bunz`);
  console.log(`  devengado:         ${m.accrued_bunz.toFixed(2)} Bunz`);
  console.log(`  pendiente:         ${m.outstanding_bunz.toFixed(2)} Bunz`);
  console.log(`  fiat cobrado:      ${m.fiat_collected_mxn.toFixed(2)} MXN`);
  console.log(`  no atendido econ.: ${m.unmet_economic_bunz.toFixed(2)} Bunz (tasa ${(m.unmet_rate * 100).toFixed(1)}%)`);
  console.log(`  no atendido oper.: ${m.unmet_operational_bunz.toFixed(2)} Bunz`);
  console.log(`  no atendido desc.: ${m.unmet_unknown_bunz.toFixed(2)} Bunz (motivo desconocido, no se imputa)`);
  console.log(`  movilidad (importe): ${m.mobility_rate_amount === null ? "n/d" : (m.mobility_rate_amount * 100).toFixed(1) + "%"}`);
  console.log(`  movilidad (conteo):  ${m.mobility_rate_count === null ? "n/d" : (m.mobility_rate_count * 100).toFixed(1) + "%"}`);
  console.log(`  CE (ratio):        ${m.ce === null ? "n/d" : m.ce.toFixed(3)}`);
  console.log(`  mora:              ${m.mora_importe_bunz.toFixed(2)} Bunz en ${m.mora_conteo} obligaciones`);

  if (report.pilot) {
    console.log("\nMODO PILOTO — no calibra, prueba instrumentación:");
    console.log(`  datasets presentes: ${report.pilot.datasets_present.length}/${report.pilot.datasets_present.length + report.pilot.datasets_missing.length}`);
    console.log(`  huecos declarados:   ${report.pilot.datasets_missing.join(", ") || "ninguno"}`);
    console.log(`  reglas no evaluables: ${report.pilot.rules_not_checked.join(", ") || "ninguna"}`);
    console.log(`  hallazgos suprimidos: ${report.pilot.suppressed_findings}`);
    console.log(`  ${report.pilot.note}`);
  }

  console.log("\nCobertura:");
  for (const c of report.coverage.cells) console.log(`  ${c.cell}: ${c.affiliates} activos`);
  console.log(`  top3 ventas: ${(report.coverage.sample_top3_sales_share * 100).toFixed(1)}%`);
  if (report.coverage.limitations.length) {
    console.log("  limitaciones:");
    for (const l of report.coverage.limitations) console.log(`    - ${l}`);
  }
}

if (args.includes("--backtest")) {
  const input = toBacktestInput(data);
  console.log(JSON.stringify(input, null, 2));
}

process.exit(report.ok ? 0 : 1);
