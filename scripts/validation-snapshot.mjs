#!/usr/bin/env node
/**
 * Genera el snapshot semanal que consume el panel GOD.
 *
 *   node scripts/validation-snapshot.mjs <dataset.json> --out snapshot.json \
 *        [--generated-at 2026-11-06T00:00:00Z] [--source-commit abc1234]
 *
 * El snapshot es el "parte" que se trae a revisión: estado, métricas, huecos,
 * reglas, backtest (si calibra) y compuertas de decisión.
 */

import fs from "node:fs";
import path from "node:path";
import { buildSnapshot } from "./lib/validation-snapshot.mjs";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const file = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
if (!file) {
  console.error("uso: node scripts/validation-snapshot.mjs <dataset.json> --out snapshot.json");
  process.exit(2);
}

const dataset = JSON.parse(fs.readFileSync(file, "utf8"));
const snapshot = buildSnapshot(dataset, {
  generatedAt: flag("--generated-at") ?? undefined,
  sourceCommit: flag("--source-commit") ?? undefined,
});

const out = flag("--out");
if (out) {
  // Escritura atómica: el panel nunca debe leer un archivo a medio escribir.
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + "\n");
  fs.renameSync(tmp, out);
}

const s = snapshot.status;
console.log(`\nsnapshot ${snapshot.export_id} · ${snapshot.dataset_kind}`);
console.log(`válido ${s.valid ? "SÍ" : "NO"} · calibrable ${s.calibration_ready ? "SÍ" : "NO"} · auditoría ${s.audit_verdict}`);
console.log(`dataset ${snapshot.dataset_hash.slice(0, 16)}…`);
if (snapshot.pilot) {
  console.log(`piloto: ${snapshot.pilot.datasets_present.length}/10 datasets · faltan ${snapshot.pilot.datasets_missing.join(", ")}`);
}
console.log(`siguiente paso: ${s.next_step}`);
if (out) console.log(`→ ${out}`);
process.exit(0);
