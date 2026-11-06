import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeSample } from "./fixtures/make-real-data-sample.mjs";
import {
  COLUMNS,
  DATASET_ORDER,
  csvDirToDataset,
  datasetToCsvDir,
  objectsToRows,
  parseCsv,
  rowsToObjects,
  stringifyCsv,
} from "./lib/real-data-csv.mjs";
import { computeMetrics, runValidation } from "./lib/real-data-spec.mjs";

const root = fileURLToPath(new URL("./", import.meta.url));
const base = () => JSON.parse(JSON.stringify(makeSample()));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bunz-csv-"));

// ── Parser ──────────────────────────────────────────────────────────────────

test("csv: comas, comillas y saltos de línea dentro de campos", () => {
  const csv = 'a,b,c\n"x, y","di ""hola""","linea1\nlinea2"\n';
  const rows = parseCsv(csv);
  assert.deepEqual(rows[0], ["a", "b", "c"]);
  assert.deepEqual(rows[1], ["x, y", 'di "hola"', "linea1\nlinea2"]);
});

test("csv: round-trip de stringify → parse", () => {
  const rows = [
    ["id", "txt"],
    ["1", 'comillas "x"'],
    ["2", "coma, interna"],
  ];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

// ── Coerción ────────────────────────────────────────────────────────────────

test("csv: coerción de números, booleanos, arrays y ausentes", () => {
  const rows = [
    ["id", "bunz", "reconciled", "reasons", "nada"],
    ["r1", "12.5", "true", "capacity_exhausted|out_of_stock", ""],
  ];
  const [obj] = rowsToObjects("treasury", rows);
  assert.equal(obj.id, "r1");
  assert.equal(obj.reconciled, true);
  assert.equal(obj.nada, undefined, "vacío = ausente, no 0");

  const [r] = rowsToObjects("redemptions", [
    ["id", "bunz", "reasons", "wait_seconds"],
    ["x", "10", "capacity_exhausted|unknown", ""],
  ]);
  assert.equal(r.bunz, 10);
  assert.deepEqual(r.reasons, ["capacity_exhausted", "unknown"]);
  assert.equal(r.wait_seconds, undefined);
});

test("csv: los números inválidos no se convierten en 0 silencioso", () => {
  const [o] = rowsToObjects("capacity", [["affiliate_id", "authorized_bunz"], ["a1", "no-numero"]]);
  assert.equal(o.authorized_bunz, undefined);
});

// ── Round-trip completo ─────────────────────────────────────────────────────

test("round-trip: fixture → CSV → dataset con las mismas métricas", () => {
  const data = base();
  const dir = tmp();
  datasetToCsvDir(data, dir);
  const back = csvDirToDataset(dir);

  const a = computeMetrics(data);
  const b = computeMetrics(back);
  for (const key of ["emitted_bunz", "redeemed_bunz", "circulating_bunz", "accrued_bunz", "outstanding_bunz", "unmet_economic_bunz"]) {
    assert.ok(Math.abs(a[key] - b[key]) < 0.01, `${key}: ${a[key]} vs ${b[key]}`);
  }
  assert.equal(back.spec_version, "1.0.0");
  assert.equal(back.window.operational.from, data.window.operational.from);
});

test("round-trip: el dataset reconstruido sigue siendo válido y calibrable", () => {
  const dir = tmp();
  datasetToCsvDir(base(), dir);
  const report = runValidation(csvDirToDataset(dir));
  assert.equal(report.ok, true, JSON.stringify(report.errors.slice(0, 5)));
  assert.equal(report.calibration_ready, true);
});

test("round-trip: no se pierden filas ni se duplican", () => {
  const data = base();
  const dir = tmp();
  datasetToCsvDir(data, dir);
  const back = csvDirToDataset(dir);
  for (const name of DATASET_ORDER) {
    assert.equal(back[name].length, data[name].length, name);
  }
});

// ── Plantillas ──────────────────────────────────────────────────────────────

test("plantillas: existen los 10 CSV con la cabecera completa", () => {
  for (const name of DATASET_ORDER) {
    const file = path.join(root, "templates", `${name}.csv`);
    assert.ok(fs.existsSync(file), `${name}.csv`);
    const header = parseCsv(fs.readFileSync(file, "utf8"))[0];
    assert.deepEqual(header, COLUMNS[name], `${name} cabecera`);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(root, "templates", "meta.json"), "utf8"));
  assert.equal(meta.dataset_kind, "template-example");
  assert.ok(meta.note.includes("BUNZ-REAL-DATA-SPEC"));
});

test("plantillas: los objetos → filas conservan el orden de columnas", () => {
  const rows = objectsToRows("redemptions", [
    { id: "r1", bunz: 5, reasons: ["capacity_exhausted"] },
  ]);
  assert.deepEqual(rows[0], COLUMNS.redemptions);
  assert.equal(rows[1][0], "r1");
  assert.equal(rows[1][COLUMNS.redemptions.indexOf("reasons")], "capacity_exhausted");
});

// ── CLI ─────────────────────────────────────────────────────────────────────

test("cli: --to-csv y --to-json reconstruyen el dataset", () => {
  const data = base();
  const dir = tmp();
  const json = path.join(dir, "origen.json");
  fs.writeFileSync(json, JSON.stringify(data));
  const csvDir = path.join(dir, "csv");
  const outJson = path.join(dir, "vuelta.json");

  execFileSync(process.execPath, [path.join(root, "real-data-csv.mjs"), "--to-csv", json, csvDir], { encoding: "utf8" });
  execFileSync(
    process.execPath,
    [path.join(root, "real-data-csv.mjs"), "--to-json", csvDir, "--write", outJson],
    { encoding: "utf8" }
  );

  const back = JSON.parse(fs.readFileSync(outJson, "utf8"));
  assert.equal(back.sales.length, data.sales.length);
  assert.equal(back.bunz_ledger.length, data.bunz_ledger.length);
  assert.equal(runValidation(back).ok, true);
});
