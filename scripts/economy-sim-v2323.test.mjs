/**
 * Pruebas v2.3.2.3.
 *
 * Primero se registran las 30 pruebas de v2.3.2.2 (se conservan como no-regresión)
 * y después se añaden las específicas de esta versión.
 */
import "./economy-sim-v2322.test.mjs";

import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPS,
  applyConcentrationCaps,
  capStatusOf,
  createCommissionBooks,
  createObligation,
  inheritedExcessOf,
  priorityViolationOf,
  settleObligations,
  splitAuthorization,
} from "./lib/economy-v2322.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// P1-A · El compromiso protegido no se recorta
// ─────────────────────────────────────────────────────────────────────────────

test("P1-A: committed > hardLimit conserva el compromiso íntegro", () => {
  const r = splitAuthorization({ desired: 10, committed: 100, hardLimit: 60, currentCeiling: 100 });

  assert.equal(r.committedProtected, 100, "no se recorta a 60");
  assert.equal(r.overHardLimit, 40, "el exceso se reporta, no se esconde");
  assert.equal(r.hardLimitBelowCommitted, true);
  assert.equal(r.available, 0, "no se autoriza nada nuevo por encima del contrato");
  assert.equal(r.granted, 0);
});

test("P1-A: committed > currentCeiling conserva el compromiso íntegro", () => {
  const r = splitAuthorization({ desired: 10, committed: 100, hardLimit: 1000, currentCeiling: 60 });

  assert.equal(r.committedProtected, 100);
  assert.equal(r.overEffectiveLimit, 40);
  assert.equal(r.ceilingBelowCommitted, true);
  assert.equal(r.hardLimitBelowCommitted, false);
  assert.equal(r.available, 0);
});

test("P1-A: el compromiso heredado no desaparece del reporte", () => {
  const r = splitAuthorization({ desired: 100, committed: 250, hardLimit: 100, currentCeiling: 80 });
  assert.equal(r.committedProtected, 250);
  assert.equal(r.overHardLimit, 150);
  assert.equal(r.overEffectiveLimit, 170);
  assert.equal(r.granted, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-B · FIFO con desempate por identificador
// ─────────────────────────────────────────────────────────────────────────────

test("P1-B: mismo dueMonth se paga por id, con entrada invertida", () => {
  const c = createObligation({ id: "c", amount: 30, month: 1, dueMonth: 3 });
  const b = createObligation({ id: "b", amount: 30, month: 1, dueMonth: 3 });
  const a = createObligation({ id: "a", amount: 30, month: 1, dueMonth: 3 });

  const r = settleObligations([c, b, a], { amount: 70, month: 3 });

  assert.deepEqual(r.order, ["a", "b", "c"], "orden por id dentro del mismo vencimiento");
  assert.equal(a.outstanding, 0);
  assert.equal(b.outstanding, 0);
  assert.equal(c.outstanding, 20, "el último recibe pago parcial");
});

test("P1-B: importes parciales respetan el orden completo", () => {
  const a = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 3 });
  const b = createObligation({ id: "b", amount: 10, month: 1, dueMonth: 3 });
  const c = createObligation({ id: "c", amount: 10, month: 1, dueMonth: 4 });

  settleObligations([c, b, a], { amount: 15, month: 4 });

  assert.equal(a.outstanding, 0);
  assert.equal(b.outstanding, 5, "b se paga antes que c aunque c tenga otro mes");
  assert.equal(c.outstanding, 10);
});

test("P1-B: priorityViolationOf detecta una violación construida a mano", () => {
  const a = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 3 });
  const b = createObligation({ id: "b", amount: 10, month: 1, dueMonth: 3 });

  // Camino defectuoso simulado: se pagó "b" saltándose "a".
  b.outstanding = 0;
  b.settlements.push({ month: 3, amount: 10 });

  const v = priorityViolationOf([a, b], { month: 3 });
  assert.ok(v, "debe detectar la violación");
  assert.deepEqual(v.violations, ["a"]);
});

test("P1-B: priorityViolationOf no da falsos positivos con pagos parciales", () => {
  const a = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 3 });
  const b = createObligation({ id: "b", amount: 10, month: 1, dueMonth: 3 });
  settleObligations([b, a], { amount: 15, month: 3 });

  assert.equal(priorityViolationOf([a, b], { month: 3 }), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-C · Cumplimiento de caps vs recuperación heredada
// ─────────────────────────────────────────────────────────────────────────────

test("P1-C: capStatusOf distingue los cuatro estados", () => {
  assert.equal(capStatusOf({ feasible: true, recovery: false, newStock: [1] }), "cumplido");
  assert.equal(
    capStatusOf({ feasible: false, recovery: true, newStock: [1, 0], blocked: 5 }),
    "recuperacion-parcial"
  );
  assert.equal(
    capStatusOf({ feasible: false, recovery: true, newStock: [0, 0], blocked: 5 }),
    "recuperacion-bloqueada"
  );
  assert.equal(
    capStatusOf({ feasible: false, recovery: false, newStock: [0, 0], blocked: 5 }),
    "infactible"
  );
  assert.equal(capStatusOf(null), "sin-caps");
});

test("P1-C: el escenario heredado se clasifica como recuperación parcial", () => {
  const existing = Array(20).fill(0).map((_, i) => (i === 0 ? 100 : 5));
  const r = applyConcentrationCaps({ existing, desiredNew: Array(20).fill(10) });
  assert.equal(capStatusOf(r), "recuperacion-parcial");
});

test("P1-C: inheritedExcessOf es 0 si cumple y > 0 si hereda", () => {
  const cumple = Array(20).fill(5);
  assert.equal(inheritedExcessOf(cumple), 0);

  const hereda = [50, 10, 10, 10];
  const exceso = inheritedExcessOf(hereda);
  assert.ok(exceso > 0);
  // (top1 0.625 − 0.25) × 80 = 30
  assert.ok(Math.abs(exceso - 30) < 1e-9);
});

test("P1-C: el exceso por categoría se mide sobre la capacidad real", () => {
  const points = [20, 20, 20, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const cats = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  const total = points.reduce((a, x) => a + x, 0);
  const cat0 = 60 / total;
  const exceso = inheritedExcessOf(points, cats);
  assert.ok(cat0 > CAPS.category);
  assert.ok(Math.abs(exceso - (cat0 - CAPS.category) * total) < 1e-9);
});

test("P1-C: cumplir caps no implica haber cumplido todos los meses", () => {
  const existing = Array(20).fill(0).map((_, i) => (i === 0 ? 100 : 5));
  const r = applyConcentrationCaps({ existing, desiredNew: Array(20).fill(10) });
  // hay exceso heredado aunque el algoritmo conceda a los pequeños
  assert.ok(inheritedExcessOf(existing) > 0);
  assert.equal(r.feasible, false);
  assert.ok(r.newStock.slice(1).some((x) => x > 0));
});

// ─────────────────────────────────────────────────────────────────────────────
// P2-F · Endowment es hipótesis, no tesorería verificada
// ─────────────────────────────────────────────────────────────────────────────

test("P2-F: el endowment se declara como hipótesis", () => {
  const books = createCommissionBooks({ endowment: 100 });
  assert.equal(books.endowmentHypothesis, true);
  assert.equal(books.endowmentSource, "hipotesis-fondeo-paquete");
  assert.equal(books.fiatCollected, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cierre de auditoría (puntual sobre v2.3.2.3)
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run } from "./economy-sim-v2323.mjs";
import { capRealStatusOf } from "./lib/economy-v2322.mjs";

const CONCENTRATED = () => {
  const s = Array(20).fill(0.2 / 17);
  s[0] = 0.3; s[1] = 0.28; s[2] = 0.22;
  return s;
};
const CATEGORY_CONCENTRATED = () => Array.from({ length: 20 }, (_, i) => (i < 10 ? 0 : 1));

test("cierre A: la salida SIM_JSON declara la versión 2.3.2.3", () => {
  const simPath = fileURLToPath(new URL("./economy-sim-v2323.mjs", import.meta.url));
  const out = execFileSync(process.execPath, [simPath], {
    env: { ...process.env, SIM_JSON: "1" },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const line = out.split("\n").find((l) => l.startsWith("JSONRESULT:"));
  assert.ok(line, "debe emitir JSONRESULT");
  const data = JSON.parse(line.slice("JSONRESULT:".length));
  assert.equal(data.version, "2.3.2.3");
  assert.equal(data.scenarios.length, 22);
  assert.equal(data.failures, 0);
});

test("cierre B: committed > hardLimit no produce falso fallo de reconciliación", () => {
  const r = run({ label: "tope contractual por debajo del compromiso", hardLimitMonths: 0.25 });

  assert.equal(r.failures.length, 0, JSON.stringify(r.failures.slice(0, 3)));
  assert.ok(r.summary.overHardLimitEnd > 0, "el exceso sobre hardLimit debe reportarse");
  assert.equal(r.summary.blockedByLimit > 0, true, "no se autoriza nada nuevo");
  // el compromiso no se revoca: la capacidad final nunca cae a cero
  assert.ok(r.summary.bcd > 0, "el compromiso heredado sigue representado");
});

test("cierre B: el check antiguo committed<=hard ya no existe", () => {
  const src = fs.readFileSync(fileURLToPath(new URL("./economy-sim-v2323.mjs", import.meta.url)), "utf8");
  assert.equal(src.includes("committed<=hard"), false);
  assert.equal(src.includes("committed-integro"), true);
});

test("cierre C: monthsOutOfCap se deriva de la medición real, no del proceso", () => {
  const r = run({
    label: "caps + categoría",
    demand: CONCENTRATED(),
    capacity: CONCENTRATED(),
    dynamicCaps: true,
    category: CATEGORY_CONCENTRATED(),
  });

  assert.equal(r.failures.length, 0);
  const incumplidos = r.history.filter((h) => h.capRealStatus === "incumplido").length;
  assert.equal(r.summary.monthsOutOfCap, incumplidos);
  assert.equal(
    r.summary.capComplianceAtEnd,
    r.history[r.history.length - 1].capRealStatus === "cumplido"
  );
  for (const h of r.history) {
    assert.equal(h.capRealStatus === "incumplido", h.capRealViolation > 1e-9);
  }
  // el diagnóstico de proceso NO es el de cumplimiento real
  assert.notEqual(r.summary.monthsOutOfCap, r.summary.monthsAuthorizationInfeasible);
  assert.equal(r.summary.monthsOutOfCap, 7);
  assert.equal(r.summary.monthsAuthorizationInfeasible, 8);
});

test("cierre C: capRealStatusOf distingue cumplido, incumplido e indefinido", () => {
  assert.equal(capRealStatusOf(0, { total: 100 }), "cumplido");
  assert.equal(capRealStatusOf(0.05, { total: 100 }), "incumplido");
  assert.equal(capRealStatusOf(0, { total: 0 }), "indefinido");
});
