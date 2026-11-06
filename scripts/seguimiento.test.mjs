import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { makeSample } from "./fixtures/make-real-data-sample.mjs";
import { makePilotSample } from "./fixtures/make-pilot-sample.mjs";
import { buildSnapshot } from "./lib/validation-snapshot.mjs";
import { checkSql, extractSchema } from "./schema-inventory.mjs";

const base = () => JSON.parse(JSON.stringify(makeSample()));
const pilot = () => JSON.parse(JSON.stringify(makePilotSample()));

// ── Esquema ─────────────────────────────────────────────────────────────────

test("esquema: extrae tablas y columnas del código", () => {
  const t = extractSchema();
  const names = Object.keys(t);
  assert.ok(names.length >= 100, `tablas: ${names.length}`);
  assert.ok(t["orders"].columns.total);
  assert.ok(t["orders"].columns.bunzPaid);
  assert.ok(t["ownedBusinesses"].columns.creditLimit);
  assert.ok(t["ownedBusinesses"].columns.createdAt, "timestamps expandidos");
  assert.ok(t["payments"].columns.reference);
});

test("esquema: el SQL read-only solo usa columnas existentes", () => {
  const sql = fs.readFileSync("DOCS/BUNZ-CAPTURA-READONLY.sql", "utf8");
  const { problems, checked } = checkSql(sql, extractSchema());
  assert.deepEqual(problems, []);
  assert.ok(checked.length >= 50, `columnas verificadas: ${checked.length}`);
});

test("esquema: detecta una columna inexistente", () => {
  const sql = 'SELECT o."inventada" FROM "orders" o';
  const { problems } = checkSql(sql, extractSchema());
  assert.equal(problems.length, 1);
  assert.ok(problems[0].includes("inventada"));
});

// ── Snapshot ─────────────────────────────────────────────────────────────────

test("snapshot de piloto: no calibra, declara huecos y siguiente paso", () => {
  const s = buildSnapshot(pilot(), { generatedAt: "2026-11-06T12:00:00Z", sourceCommit: "abc1234" });
  assert.equal(s.snapshot_version, "1.0");
  assert.equal(s.dataset_kind, "pilot");
  assert.equal(s.status.valid, true);
  assert.equal(s.status.calibration_ready, false);
  assert.equal(s.backtest.skipped, true);
  assert.deepEqual(s.pilot.datasets_missing, ["obligations", "bunz_ledger", "abuse_signals"]);
  assert.ok(s.status.next_step.includes("instrumentar"));
  assert.equal(s.decisions.length, 9);
  assert.match(s.dataset_hash, /^[0-9a-f]{64}$/);
  assert.match(s.artifacts.audit_hash, /^[0-9a-f]{64}$/);
});

test("snapshot calibrable: ejecuta backtest y lo marca fuera de muestra", () => {
  const s = buildSnapshot(base(), { generatedAt: "2026-11-06T12:00:00Z" });
  assert.equal(s.status.calibration_ready, true);
  assert.equal(s.backtest.skipped, undefined);
  assert.equal(s.backtest.in_sample, false);
  assert.ok(s.backtest.calibration.export_hash);
  assert.ok(s.backtest.evaluation.export_hash);
});

test("snapshot: las compuertas incluyen RP-2 y no se declaran aprobadas", () => {
  const s = buildSnapshot(pilot());
  const g9 = s.decisions.find((d) => d.id === "G9");
  assert.ok(g9);
  assert.equal(g9.status, "pendiente");
  assert.ok(s.decisions.every((d) => ["hecho", "en-curso", "pendiente"].includes(d.status)));
});

test("snapshot: un dataset inválido no se presenta como válido", () => {
  const d = pilot();
  d.capacity[0].consumed_bunz = d.capacity[0].authorized_bunz + 5;
  const s = buildSnapshot(d);
  assert.equal(s.status.valid, false);
  assert.equal(s.status.calibration_ready, false);
  assert.ok(s.status.next_step.includes("corregir"));
  assert.equal(s.backtest.skipped, true);
});

// ── Plan y checklist dentro del snapshot ────────────────────────────────────

test("snapshot: incluye plan (9 OT) y checklist (8 pasos)", () => {
  const s = buildSnapshot(pilot());
  assert.equal(s.roadmap.length, 9);
  assert.equal(s.checklist.length, 8);
  assert.deepEqual(s.roadmap.map((r) => r.id), ["OT-8", "OT-7", "OT-6", "OT-1", "OT-4", "OT-3", "OT-2", "OT-5", "OT-9"]);
});

test("snapshot: la checklist refleja el estado real, no un ideal", () => {
  const p = buildSnapshot(pilot());
  const item = (s, id) => s.checklist.find((c) => c.id === id);
  assert.equal(item(p, "errors").ok, true);
  assert.equal(item(p, "backtest").ok, false);
  assert.equal(item(p, "backtest").detail, "no ejecutado");
  assert.equal(item(p, "calibration").ok, false);
  assert.equal(item(p, "decisions").ok, false);

  const f = buildSnapshot(base());
  assert.equal(item(f, "backtest").ok, true, "calibrable ⇒ backtest fuera de muestra");
  assert.equal(item(f, "calibration").ok, true);
});

test("snapshot: las OT hechas y pendientes no se mezclan", () => {
  const s = buildSnapshot(pilot());
  const hechas = s.roadmap.filter((r) => r.status === "hecho").map((r) => r.id);
  assert.deepEqual(hechas, ["OT-8", "OT-7", "OT-6"]);
  assert.ok(s.roadmap.filter((r) => r.status === "pendiente").length === 6);
});

// ── Alertas ────────────────────────────────────────────────────────────────

test("snapshot: alertas deterministas y accionables", () => {
  const p = buildSnapshot(pilot());
  const codes = p.alerts.map((a) => a.code);
  assert.ok(codes.includes("ALR-04"), "faltan datasets");
  assert.ok(codes.includes("ALR-05"), "paridad no aprobada");
  assert.ok(codes.includes("ALR-02"), "no calibrable");
  assert.equal(codes.includes("ALR-01"), false, "no hay errores");

  const f = buildSnapshot(base());
  assert.ok(f.alerts.some((a) => a.code === "ALR-03"), "demanda no atendida");
  assert.equal(f.alerts.some((a) => a.code === "ALR-01"), false);
  assert.equal(f.alerts.some((a) => a.code === "ALR-06"), false, "el backtest sí corrió");
});
