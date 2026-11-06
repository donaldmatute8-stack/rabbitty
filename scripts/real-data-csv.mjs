#!/usr/bin/env node
/**
 * Kit de exportación: CSV ⇄ dataset JSON validado por el contrato v1.0.
 *
 *   node scripts/real-data-csv.mjs --to-json <directorio_csv> [--write salida.json]
 *   node scripts/real-data-csv.mjs --to-csv  <dataset.json> <directorio_salida>
 *
 * En --to-json valida con el mismo validador que usa el pipeline y sale con 1
 * si el dataset no cumple el contrato.
 */

import fs from "node:fs";
import {
  csvDirToDataset,
  datasetToCsvDir,
} from "./lib/real-data-csv.mjs";
import { runValidation } from "./lib/real-data-spec.mjs";

const args = process.argv.slice(2);
const mode = args.includes("--to-csv") ? "to-csv" : args.includes("--to-json") ? "to-json" : null;
const positional = args.filter((a) => !a.startsWith("--"));
const writeIdx = args.indexOf("--write");
const writeTo = writeIdx >= 0 ? args[writeIdx + 1] : null;

if (!mode || positional.length === 0) {
  console.error(
    "uso:\n" +
      "  node scripts/real-data-csv.mjs --to-json <dir_csv> [--write salida.json]\n" +
      "  node scripts/real-data-csv.mjs --to-csv <dataset.json> <dir_salida>"
  );
  process.exit(2);
}

try {
  if (mode === "to-csv") {
    const [file, outDir] = positional;
    const dataset = JSON.parse(fs.readFileSync(file, "utf8"));
    datasetToCsvDir(dataset, outDir);
    console.log(`OK: CSV escritos en ${outDir}`);
  } else {
    const [dir] = positional;
    const dataset = csvDirToDataset(dir);
    const report = runValidation(dataset);

    console.log(`\nDataset construido desde CSV: ${dir}`);
    console.log(`spec v${report.spec_version} · válido: ${report.ok ? "SÍ" : "NO"} · errores: ${report.errors.length} · avisos: ${report.warnings.length}`);
    console.log(`calibración habilitada: ${report.calibration_ready ? "SÍ" : "NO"}`);
    console.log(`filas: ${JSON.stringify(report.counts.datasets)}`);

    for (const e of report.errors.slice(0, 25)) console.log(`  [${e.code}] ${e.msg}`);
    for (const w of report.warnings.slice(0, 25)) console.log(`  (${w.code}) ${w.msg}`);

    if (writeTo) {
      fs.writeFileSync(writeTo, JSON.stringify(dataset, null, 2) + "\n");
      console.log(`\nJSON escrito en ${writeTo}`);
    }

    process.exit(report.ok ? 0 : 1);
  }
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(2);
}
