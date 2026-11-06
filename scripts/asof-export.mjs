#!/usr/bin/env node
/**
 * OT-7 · Export as-of desde un journal append-only.
 *
 *   # 1) construir journal desde un dataset consolidado (todo conocido en una fecha)
 *   node scripts/asof-export.mjs --journal-from dataset.json --recorded-at 2026-03-31 --out journal.json
 *
 *   # 2) materializar el conocimiento disponible a un corte
 *   node scripts/asof-export.mjs journal.json --cut 2026-03-31 --out asof.json
 *
 * Al exportar imprime hashes y valida el resultado con el contrato v1.0.
 */

import fs from "node:fs";
import { asOf, createJournal, exportHash, journalHash } from "./lib/asof.mjs";
import { runValidation } from "./lib/real-data-spec.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const positional = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") === false);

const journalFrom = flag("--journal-from");
const out = flag("--out");

if (journalFrom) {
  const recordedAt = flag("--recorded-at");
  if (!recordedAt) {
    console.error("falta --recorded-at");
    process.exit(2);
  }
  const dataset = JSON.parse(fs.readFileSync(journalFrom, "utf8"));
  const journal = createJournal(dataset, { recorded_at: recordedAt });
  if (out) fs.writeFileSync(out, JSON.stringify(journal, null, 2) + "\n");
  console.log(`journal: ${journal.length} entradas · hash ${journalHash(journal).slice(0, 16)}…${out ? ` → ${out}` : ""}`);
  process.exit(0);
}

const journalFile = args.find((a) => a.endsWith(".json"));
const cut = flag("--cut");
if (!journalFile || !cut) {
  console.error("uso: node scripts/asof-export.mjs <journal.json> --cut YYYY-MM-DD [--out salida.json]");
  process.exit(2);
}

const journal = JSON.parse(fs.readFileSync(journalFile, "utf8"));
const dataset = asOf(journal, cut);
const report = runValidation(dataset);

if (args.includes("--json")) {
  console.log(JSON.stringify({ cut, journal_hash: journalHash(journal), export_hash: exportHash(dataset), report, dataset }, null, 2));
} else {
  console.log(`\nas-of ${cut}`);
  console.log(`journal ${journalHash(journal).slice(0, 16)}… · export ${exportHash(dataset).slice(0, 16)}…`);
  console.log(`válido: ${report.ok ? "SÍ" : "NO"} · errores ${report.errors.length} · avisos ${report.warnings.length} · calibración ${report.calibration_ready ? "SÍ" : "NO"}`);
  console.log(`filas: ${JSON.stringify(report.counts.datasets)}`);
  for (const e of report.errors.slice(0, 10)) console.log(`  [${e.code}] ${e.msg}`);
  for (const w of report.warnings.slice(0, 10)) console.log(`  (${w.code}) ${w.msg}`);
  if (out) {
    fs.writeFileSync(out, JSON.stringify(dataset, null, 2) + "\n");
    console.log(`→ ${out}`);
  }
}

process.exit(report.ok ? 0 : 1);
