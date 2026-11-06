#!/usr/bin/env node
/**
 * Backtest aislado: dataset validado → parámetros medidos → simulación → comparación.
 * Uso: node scripts/backtest-run.mjs <dataset.json> [--json]
 * Salida: informe de ajuste. NUNCA declara la economía aprobada.
 */

import fs from "node:fs";
import { runBacktest } from "./lib/backtest.mjs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("uso: node scripts/backtest-run.mjs <dataset.json> [--json]");
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(`no se pudo leer ${file}: ${err.message}`);
  process.exit(2);
}

const report = runBacktest(data);

if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict === "no-apto" ? 1 : 0);
}

const pct = (x) => (x === null || x === undefined ? "n/d" : `${(x * 100).toFixed(1)}%`);
const num = (x) => (x === null || x === undefined ? "n/d" : Math.round(x).toLocaleString("en-US"));

console.log(`\nBACKTEST Bunz — spec v${report.spec_version}`);
console.log(`Dataset: ${file}`);
console.log(`Veredicto: ${report.verdict}`);

if (report.verdict === "no-apto") {
  console.log(`Motivo: ${report.reason}`);
  for (const e of (report.errors || []).slice(0, 10)) console.log(`  [${e.code}] ${e.msg}`);
  for (const w of (report.warnings || []).slice(0, 10)) console.log(`  [${w.code}] ${w.msg}`);
  console.log(`\n${report.disclaimer}`);
  process.exit(1);
}

console.log(
  `\nParámetros medidos: n=${report.parameters.n} | meses=${report.parameters.months} | ` +
    `rewardRate=${pct(report.parameters.rewardRate)} | redemptionRate=${pct(report.parameters.redemptionRate)} | ` +
    `cobertura=${report.parameters.coverageDays}d | movilidad=${pct(report.parameters.mobility)} | ` +
    `disputas=${pct(report.parameters.disputedShare)}`
);

console.log("\nSerie                          MAPE     MAE    sesgo      obs.medio    sim.medio   meses");
for (const [name, s] of Object.entries(report.series)) {
  console.log(
    name.padEnd(28),
    pct(s.mape).padStart(7),
    num(s.mae).padStart(8),
    num(s.bias).padStart(8),
    num(s.observed_mean).padStart(12),
    num(s.simulated_mean).padStart(12),
    String(s.mape_months).padStart(6)
  );
}

console.log("\nConcentración (top1 / top3 / HHI):");
console.log(
  `  observada: ${pct(report.concentration.observed.top1)} / ${pct(report.concentration.observed.top3)} / ${report.concentration.observed.hhi.toFixed(3)}`
);
console.log(
  `  simulada:  ${pct(report.concentration.simulated.top1)} / ${pct(report.concentration.simulated.top3)} / ${report.concentration.simulated.hhi.toFixed(3)}`
);
console.log(
  `  delta pp:  ${report.concentration.delta_pp.top1.toFixed(1)} / ${report.concentration.delta_pp.top3.toFixed(1)} / ${report.concentration.delta_pp.hhi.toFixed(1)}`
);

if (report.failed_checks.length) {
  console.log(`\nChecks que no pasan el umbral preliminar: ${report.failed_checks.join(", ")}`);
}
console.log(`\nReconciliación del modelo: ${report.reconciliation.checks} checks, ${report.reconciliation.failures} fallos, ${report.reconciliation.fifo_violations} violaciones FIFO.`);
console.log(`\n${report.disclaimer}`);
