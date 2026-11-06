import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeSample } from "./fixtures/make-real-data-sample.mjs";
import {
  activeEvents,
  computeMetrics,
  runValidation,
  toBacktestInput,
  validateLedger,
} from "./lib/real-data-spec.mjs";

const base = () => JSON.parse(JSON.stringify(makeSample()));
const codes = (list) => list.map((x) => x.code);

// ── El contrato se cumple ────────────────────────────────────────────────────

test("spec v1.0: el fixture sintético es válido, sin errores ni avisos", () => {
  const report = runValidation(base());
  assert.equal(report.ok, true, JSON.stringify(report.errors.slice(0, 5)));
  assert.equal(report.errors.length, 0);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.calibration_ready, true);
  assert.equal(report.spec_version, "1.0.0");
});

test("spec v1.0: la versión del dataset está declarada y es la esperada", () => {
  const data = base();
  assert.equal(data.spec_version, "1.0.0");
  const bad = { ...data, spec_version: "0.9.0" };
  assert.ok(codes(runValidation(bad).errors).includes("R00"));
});

// ── R01 · Identificadores ───────────────────────────────────────────────────

test("R01: identificador duplicado se rechaza", () => {
  const data = base();
  data.redemptions.push({ ...data.redemptions[0] });
  const report = runValidation(data);
  assert.equal(report.ok, false);
  assert.ok(codes(report.errors).includes("R01"));
});

// ── R02 · Referencias ───────────────────────────────────────────────────────

test("R02: redención con recompensa inexistente se rechaza", () => {
  const data = base();
  data.redemptions[0].reward_id = "rw-inexistente";
  const report = runValidation(data);
  assert.ok(codes(report.errors).includes("R02"));
});

test("R02: asiento con obligación inexistente se rechaza", () => {
  const data = base();
  const entry = data.bunz_ledger.find((e) => e.ref_type === "obligation");
  entry.ref_id = "ob-inexistente";
  assert.ok(codes(runValidation(data).errors).includes("R02"));
});

// ── R10 · Doble libro ───────────────────────────────────────────────────────

test("R10: un grupo descuadrado se rechaza", () => {
  const entries = [
    { id: "1", group: "g1", account: "emission_budget", direction: "debit", amount: 10 },
    { id: "2", group: "g1", account: "user_wallet", direction: "credit", amount: 9 },
  ];
  const errs = validateLedger(entries);
  assert.equal(errs.length, 1);
  assert.equal(errs[0].code, "R10");
});

test("R10: cuenta desconocida se rechaza", () => {
  const errs = validateLedger([
    { id: "1", group: "g", account: "cuenta_inventada", direction: "debit", amount: 1 },
  ]);
  assert.ok(errs.some((e) => e.code === "R10"));
});

// ── R05 · Capacidad ─────────────────────────────────────────────────────────

test("R05: capacidad consumida mayor que la autorizada se rechaza", () => {
  const data = base();
  data.capacity[0].consumed_bunz = data.capacity[0].authorized_bunz + 1;
  assert.ok(codes(runValidation(data).errors).includes("R05"));
});

// ── R07 / R22 · Motivos ─────────────────────────────────────────────────────

test("R07: redención no atendida sin motivo se rechaza", () => {
  const data = base();
  const r = data.redemptions.find((x) => x.status === "unfulfilled");
  r.reasons = [];
  assert.ok(codes(runValidation(data).errors).includes("R07"));
});

test("R22: 'unknown' no se imputa como demanda económica no atendida", () => {
  const data = base();
  const r = data.redemptions.find((x) => x.status === "unfulfilled" && x.reasons.includes("capacity_exhausted"));
  const before = computeMetrics(data);
  r.reasons = ["unknown"];
  const after = computeMetrics(data);

  assert.ok(after.unmet_economic_bunz < before.unmet_economic_bunz, "deja de ser económico");
  assert.ok(after.unmet_unknown_bunz > before.unmet_unknown_bunz, "pasa a 'desconocido'");
});

test("R07: un motivo económico sí cuenta como no atendido", () => {
  const data = base();
  const r = data.redemptions.find((x) => x.status === "unfulfilled" && x.reasons.includes("capacity_exhausted"));
  const amount = r.bunz - (r.fulfilled_bunz || 0);
  const metrics = computeMetrics(data);
  assert.ok(metrics.unmet_economic_bunz >= amount - 0.01);
  assert.ok(metrics.unmet_by_reason.capacity_exhausted >= amount - 0.01);
});

// ── R23 · Reversiones ───────────────────────────────────────────────────────

test("R23: una recompensa revertida no se cuenta dos veces", () => {
  const data = base();
  const rewards = activeEvents(data.rewards_issued);
  const reversal = data.rewards_issued.find((r) => r.reversal_of);
  const original = data.rewards_issued.find((r) => r.id === reversal.reversal_of);

  assert.ok(!rewards.some((r) => r.id === reversal.id), "la reversión no está activa");
  assert.ok(!rewards.some((r) => r.id === original.id), "el original revertido no está activo");

  const metrics = computeMetrics(data);
  const expected = rewards.reduce((a, r) => a + r.bunz, 0);
  assert.ok(Math.abs(metrics.emitted_bunz - expected) < 0.01);
});

// ── R08 / R09 · Obligaciones ────────────────────────────────────────────────

test("R08: obligación pagada sin instrumento se rechaza", () => {
  const data = base();
  const o = data.obligations.find((x) => x.state === "PAID");
  o.instrument = null;
  assert.ok(codes(runValidation(data).errors).includes("R08"));
});

test("R09: castigo sin fecha de castigo se rechaza", () => {
  const data = base();
  const o = data.obligations.find((x) => x.state === "RESOLVED_NOT_PAYABLE");
  o.written_off_at = null;
  assert.ok(codes(runValidation(data).errors).includes("R09"));
});

test("R14: devengado = liquidado Bunz + fiat + castigado + pendiente", () => {
  const m = computeMetrics(base());
  const identity = m.settled_bunz + m.settled_fiat_mxn + m.written_off_bunz + m.outstanding_bunz;
  assert.ok(Math.abs(identity - m.accrued_bunz) < 0.01);
});

// ── R17 · Fiat ──────────────────────────────────────────────────────────────

test("R17: pago sin bank_ref no cuenta como cobrado y avisa", () => {
  const data = base();
  const f = data.fiat_settlements[0];
  f.bank_ref = null;
  f.reconciled = false;
  const before = computeMetrics(base());
  const after = computeMetrics(data);
  const report = runValidation(data);

  assert.ok(after.fiat_collected_mxn < before.fiat_collected_mxn);
  assert.ok(codes(report.warnings).includes("R17"));
  assert.equal(report.ok, true, "es aviso, no error");
});

// ── R15 / R16 · Tesorería ───────────────────────────────────────────────────

test("R15: snapshot de tesorería que no cuadra con el libro se rechaza", () => {
  const data = base();
  data.treasury.at(-1).bunz_balance += 1000;
  assert.ok(codes(runValidation(data).errors).includes("R15"));
});

test("R16: snapshot conciliado con diferencia bancaria se rechaza", () => {
  const data = base();
  data.treasury.at(-1).bank_balance += 500;
  assert.ok(codes(runValidation(data).errors).includes("R16"));
});

// ── R18 / R19 · Ventanas y huecos ───────────────────────────────────────────

test("R19: ventana operativa menor de 12 semanas se rechaza", () => {
  const data = base();
  data.window.operational = { from: "2026-01-01", to: "2026-01-30" };
  assert.ok(codes(runValidation(data).errors).includes("R19"));
});

test("R18: hueco en la serie semanal genera aviso", () => {
  const data = base();
  data.treasury = data.treasury.filter((_, i) => i !== 5 && i !== 6);
  assert.ok(codes(runValidation(data).warnings).includes("R18"));
});

// ── R20 / R21 · Representatividad ───────────────────────────────────────────

test("R20: celda con menos de 5 afiliados activos se declara insuficiente", () => {
  const data = base();
  const target = data.affiliates.find((a) => a.status === "active" && a.category === "food" && a.size_band === "S");
  target.status = "inactive";
  const report = runValidation(data);
  assert.ok(codes(report.warnings).includes("R20"));
  assert.equal(report.calibration_ready, false);
  assert.ok(report.coverage.limitations.length > 0);
});

test("R21: muestra concentrada (top3 > 60%) se declara", () => {
  const data = base();
  const top = data.affiliates.filter((a) => a.status === "active").slice(0, 3).map((a) => a.id);
  for (const s of data.sales) if (top.includes(s.affiliate_id)) s.gross_mxn *= 40;
  const report = runValidation(data);
  assert.ok(codes(report.warnings).includes("R21"));
  assert.ok(report.coverage.sample_top3_sales_share > 0.6);
});

test("R20: cobertura suficiente no produce aviso de representatividad", () => {
  const report = runValidation(base());
  assert.equal(codes(report.warnings).includes("R20"), false);
  assert.equal(codes(report.warnings).includes("R21"), false);
});

// ── Export de backtest ──────────────────────────────────────────────────────

test("backtest: los totales mensuales cuadran con las métricas", () => {
  const data = base();
  const metrics = computeMetrics(data);
  const input = toBacktestInput(data);
  const total = (k) => input.monthly.reduce((a, r) => a + r[k], 0);

  assert.ok(Math.abs(total("demand_mxn") - data.sales.reduce((a, s) => a + s.gross_mxn, 0)) < 0.01);
  assert.ok(Math.abs(total("rewards_issued_bunz") - metrics.emitted_bunz) < 0.01);
  assert.ok(Math.abs(total("redeemed_bunz") - metrics.redeemed_bunz) < 0.01);
  assert.ok(Math.abs(total("unmet_economic_bunz") - metrics.unmet_economic_bunz) < 0.01);
  assert.equal(input.metadata.spec_version, "1.0.0");
  assert.ok(input.metadata.months.length >= 6);
  assert.ok(Array.isArray(input.metadata.missing_metrics));
});

test("movilidad: sólo cuenta lo redimido fuera del afiliado de origen", () => {
  const m = computeMetrics(base());
  assert.ok(m.mobility_rate_count > 0 && m.mobility_rate_count < 1);
  assert.ok(m.mobility_rate_amount > 0 && m.mobility_rate_amount < 1);
});

test("CE: no se calcula si no hay circulación ni tesorería", () => {
  const empty = {
    spec_version: "1.0.0",
    window: { operational: { from: "2026-01-01", to: "2026-03-31" }, financial: { from: "2025-10-01", to: "2026-03-31" } },
    affiliates: [], sales: [], rewards_issued: [], redemptions: [], capacity: [],
    obligations: [], fiat_settlements: [], bunz_ledger: [], treasury: [], abuse_signals: [],
  };
  assert.equal(computeMetrics(empty).ce, null);
});

test("integridad: el fixture generado es estable en disco", () => {
  const onDisk = JSON.parse(
    fs.readFileSync(fileURLToPath(new URL("./fixtures/real-data-sample.json", import.meta.url)), "utf8")
  );
  const generated = makeSample();
  assert.equal(onDisk.sales.length, generated.sales.length);
  assert.equal(onDisk.bunz_ledger.length, generated.bunz_ledger.length);
  assert.equal(onDisk.dataset_kind, "synthetic-fixture");
});

// ── R24 · Unidades Bunz/MXN ─────────────────────────────────────────────────

test("R24: sin unit_policy no se calibra (conversión implícita)", () => {
  const data = base();
  delete data.unit_policy;
  const report = runValidation(data);
  assert.equal(report.ok, true, "no es error estructural");
  assert.equal(report.calibration_ready, false);
  assert.ok(codes(report.warnings).includes("R24"));
});

test("R24: paridad declarada pero no aprobada bloquea la calibración", () => {
  const data = base();
  data.unit_policy = { bunz_per_mxn: 1, approved: false };
  const report = runValidation(data);
  assert.equal(report.calibration_ready, false);
  assert.ok(codes(report.warnings).includes("R24"));
  assert.ok(report.warnings.find((w) => w.code === "R24").msg.includes("mezcla unidades"));
});

test("R24: paridad inválida es error", () => {
  const data = base();
  data.unit_policy = { bunz_per_mxn: 0, approved: true };
  assert.ok(codes(runValidation(data).errors).includes("R24"));
});

// ── R25 · Agregación de capacidad ───────────────────────────────────────────

test("R25: sin capacity_scope no se calibra", () => {
  const data = base();
  delete data.capacity_scope;
  const report = runValidation(data);
  assert.equal(report.calibration_ready, false);
  assert.ok(codes(report.warnings).includes("R25"));
});

test("R25: scope=affiliate es válido con el fixture", () => {
  const report = runValidation(base());
  assert.equal(report.meta.capacity_scope, "affiliate");
  assert.equal(report.calibration_ready, true);
});

test("R25: scope=branch exige branch_id y no admite duplicados por sucursal/fecha", () => {
  const sinBranch = base();
  sinBranch.capacity_scope = "branch";
  assert.ok(codes(runValidation(sinBranch).errors).includes("R25"));

  const dup = base();
  dup.capacity_scope = "branch";
  dup.capacity = dup.capacity.map((c) => ({ ...c, branch_id: `b-${c.affiliate_id}` }));
  dup.capacity.push({ ...dup.capacity[0] });
  assert.ok(codes(runValidation(dup).errors).includes("R25"));
});

// ── R26 · Conciliación por obligación ───────────────────────────────────────

test("R26: PAID cuya suma liquidada no coincide con el importe", () => {
  const data = base();
  const o = data.obligations.find((x) => x.state === "PAID" && x.instrument === "bunz");
  o.settled_bunz = o.bunz - 10;
  assert.ok(codes(runValidation(data).errors).includes("R26"));
});

test("R26: liquidado mayor que el importe de la obligación", () => {
  const data = base();
  const o = data.obligations.find((x) => x.state === "PAID");
  o.settled_bunz = o.bunz + 1;
  assert.ok(codes(runValidation(data).errors).includes("R26"));
});

test("R26: cobros fiat por obligación mayores que lo declarado liquidado", () => {
  const data = base();
  const f = data.fiat_settlements[0];
  f.amount_mxn = f.amount_mxn + 100;
  assert.ok(codes(runValidation(data).errors).includes("R26"));
});

test("R26: el fixture concilia por obligación (no solo en agregado)", () => {
  const report = runValidation(base());
  assert.equal(codes(report.errors).includes("R26"), false);
});

// ── Modo piloto (n=1, sin calibración) ──────────────────────────────────────

import { makePilotSample } from "./fixtures/make-pilot-sample.mjs";
const pilot = () => JSON.parse(JSON.stringify(makePilotSample()));

test("piloto: válido pero NO calibrable, con huecos declarados", () => {
  const report = runValidation(pilot());
  assert.equal(report.ok, true, JSON.stringify(report.errors.slice(0, 3)));
  assert.equal(report.calibration_ready, false, "un piloto nunca calibra");
  assert.deepEqual(report.pilot.datasets_missing, ["obligations", "bunz_ledger", "abuse_signals"]);
  assert.equal(report.pilot.datasets_present.length, 7);
  assert.ok(report.pilot.gaps.length === 3);
  assert.ok(report.pilot.note.includes("no calibra"));
});

test("piloto: las reglas que dependen de datasets ausentes se declaran no evaluables", () => {
  const report = runValidation(pilot());
  for (const code of ["R10", "R11", "R12", "R13", "R14", "R15", "R26", "R08", "R09"]) {
    assert.ok(report.pilot.rules_not_checked.includes(code), code);
  }
  assert.ok(report.pilot.suppressed_findings >= 0);
});

test("piloto: la ventana corta es limitación declarada, no error", () => {
  const report = runValidation(pilot());
  assert.equal(codes(report.errors).includes("R19"), false);
  assert.ok(codes(report.warnings).includes("R19"));
  assert.ok(report.warnings.find((w) => w.code === "R19").msg.includes("piloto"));
});

test("piloto: un error real en un dataset presente sigue siendo error", () => {
  const data = pilot();
  data.capacity[0].consumed_bunz = data.capacity[0].authorized_bunz + 1;
  const report = runValidation(data);
  assert.equal(report.ok, false);
  assert.ok(codes(report.errors).includes("R05"));
});

test("fuera de piloto, un dataset ausente sigue siendo error", () => {
  const data = base();
  delete data.bunz_ledger;
  const report = runValidation(data);
  assert.equal(report.ok, false);
  assert.ok(codes(report.errors).includes("R00"));
  assert.equal(report.pilot, null);
});

// ── R26 · corrección dimensional (Bunz vs MXN) ──────────────────────────────

test("R26: sin paridad aprobada no se mezclan unidades; se avisa y se valida por separado", () => {
  const data = base();
  data.unit_policy = { bunz_per_mxn: 1, approved: false };
  const o = data.obligations.find((x) => x.instrument === "fiat");
  o.settled_fiat_mxn = o.bunz * 5; // disparate dimensional

  const report = runValidation(data);
  assert.equal(codes(report.errors).includes("R26"), false, "no se compara Bunz con MXN sin paridad");
  assert.ok(codes(report.warnings).includes("R26"));
  assert.ok(report.warnings.find((w) => w.code === "R26").msg.includes("paridad no aprobada"));
});

test("R26: sin paridad, un exceso en la misma unidad (Bunz) sigue siendo error", () => {
  const data = base();
  data.unit_policy = { bunz_per_mxn: 1, approved: false };
  const o = data.obligations.find((x) => x.state === "PAID" && x.instrument === "bunz");
  o.settled_bunz = o.bunz + 10;
  assert.ok(codes(runValidation(data).errors).includes("R26"));
});

test("R26: con paridad aprobada, la conversión es explícita (bunz_per_mxn)", () => {
  const data = base();
  data.unit_policy = { bunz_per_mxn: 2, approved: true }; // 1 MXN = 2 Bunz

  // Todas las obligaciones fiat se reinterpretan con la paridad declarada.
  for (const o of data.obligations.filter((x) => (x.settled_fiat_mxn || 0) > 0)) {
    o.settled_fiat_mxn = o.bunz / 2;
    const f = data.fiat_settlements.find((x) => x.obligation_id === o.id);
    if (f) f.amount_mxn = o.bunz / 2;
  }
  assert.equal(codes(runValidation(data).errors).includes("R26"), false);

  // 20 Bunz de más en una sola obligación ⇒ error dimensional explícito.
  const o = data.obligations.find((x) => (x.settled_fiat_mxn || 0) > 0);
  const f = data.fiat_settlements.find((x) => x.obligation_id === o.id);
  o.settled_fiat_mxn = o.bunz / 2 + 10;
  if (f) f.amount_mxn = o.bunz / 2 + 10;
  const errors = runValidation(data).errors;
  assert.ok(codes(errors).includes("R26"));
  assert.ok(errors.some((e) => e.code === "R26" && e.msg.includes("Bunz/MXN")));
});

test("R26: los cobros fiat se validan MXN contra MXN aunque no haya paridad", () => {
  const data = base();
  data.unit_policy = { bunz_per_mxn: 1, approved: false };
  const f = data.fiat_settlements[0];
  f.amount_mxn = f.amount_mxn + 100;
  assert.ok(codes(runValidation(data).errors).includes("R26"));
});
