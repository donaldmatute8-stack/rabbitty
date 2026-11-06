import test from "node:test";
import assert from "node:assert/strict";
import {
  OBLIGATION_STATE,
  applyConcentrationCaps,
  authorizeStock,
  createObligation,
  outstandingOf,
  payObligations,
  redistribute,
  redistributeInvariants,
  resolveDispute,
} from "./lib/economy-v232.mjs";

test("redistribución: perfecta mueve demanda a capacidad libre", () => {
  const r = redistribute({ requested: [10, 10], capacity: [20, 0], mobility: 1 });
  assert.deepEqual(r.servedLocal, [10, 0]);
  assert.equal(r.totalReassigned, 10);
  assert.equal(r.totalServed, 20);
  assert.equal(r.totalUnmetEcosystem, 0);
  assert.equal(redistributeInvariants(r, [10, 10], [20, 0]).ok, true);
});

test("redistribución: movilidad nula conserva unmet local", () => {
  const r = redistribute({ requested: [10, 10], capacity: [20, 0], mobility: 0 });
  assert.equal(r.totalReassigned, 0);
  assert.equal(r.totalUnmetLocal, 10);
  assert.equal(r.totalUnmetEcosystem, 10);
});

test("redistribución: parcial y sin exceder capacidad", () => {
  const r = redistribute({ requested: [10, 10], capacity: [20, 0], mobility: 0.5 });
  assert.equal(r.totalReassigned, 5);
  assert.equal(r.totalUnmetEcosystem, 5);
  const inv = redistributeInvariants(r, [10, 10], [20, 0]);
  assert.equal(inv.ok, true, JSON.stringify(inv.checks));
});

test("redistribución: independiente del orden", () => {
  const requested = [5, 15, 10, 20];
  const capacity = [0, 10, 30, 5];
  const a = redistribute({ requested, capacity, mobility: 1 });
  const order = [3, 1, 0, 2];
  const b = redistribute({
    requested: order.map((i) => requested[i]),
    capacity: order.map((i) => capacity[i]),
    mobility: 1,
  });
  assert.ok(Math.abs(a.totalServed - b.totalServed) < 1e-9);
  assert.ok(Math.abs(a.totalUnmetEcosystem - b.totalUnmetEcosystem) < 1e-9);
  assert.ok(Math.abs(a.totalReassigned - b.totalReassigned) < 1e-9);
});

test("obligación: pago parcial y total", () => {
  const o = createObligation({ id: "a", amount: 100, month: 1, dueMonth: 2 });
  assert.equal(o.state, OBLIGATION_STATE.OPEN);
  assert.equal(payObligations([o], 40, 2), 40);
  assert.equal(o.state, OBLIGATION_STATE.PARTIALLY_PAID);
  assert.equal(o.outstanding, 60);
  assert.equal(payObligations([o], 100, 3), 60);
  assert.equal(o.state, OBLIGATION_STATE.PAID);
  assert.equal(o.outstanding, 0);
});

test("disputa: no payable hasta resolver; resolución favorable paga", () => {
  const o = createObligation({ id: "d", amount: 50, month: 1, dueMonth: 2, disputed: true });
  assert.equal(payObligations([o], 50, 2), 0);
  assert.equal(outstandingOf([o], { overdue: true, month: 5 }), 0);
  assert.equal(outstandingOf([o], { includeDisputed: true }), 50);
  assert.equal(resolveDispute(o, 3, true), true);
  assert.equal(o.state, OBLIGATION_STATE.RESOLVED_PAYABLE);
  assert.equal(outstandingOf([o], { overdue: true, month: 5 }), 50);
  assert.equal(payObligations([o], 50, 5), 50);
  assert.equal(o.state, OBLIGATION_STATE.PAID);
});

test("disputa: resolución no payable se castiga y no bloquea", () => {
  const o = createObligation({ id: "d2", amount: 70, month: 1, dueMonth: 2, disputed: true });
  resolveDispute(o, 3, false);
  assert.equal(o.state, OBLIGATION_STATE.RESOLVED_NOT_PAYABLE);
  assert.equal(o.writtenOff, 70);
  assert.equal(outstandingOf([o], { includeDisputed: true }), 0);
  assert.equal(payObligations([o], 70, 4), 0);
});

test("deuda larga vencida excluye la reciente", () => {
  const old = createObligation({ id: "old", amount: 10, month: 1, dueMonth: 2 });
  const recent = createObligation({ id: "new", amount: 10, month: 4, dueMonth: 5 });
  assert.equal(outstandingOf([old, recent], { longOverdue: true, month: 5 }), 10);
});

test("paga primero la obligación más antigua", () => {
  const a = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 2 });
  const b = createObligation({ id: "b", amount: 10, month: 2, dueMonth: 3 });
  payObligations([b, a], 15, 4);
  assert.equal(a.outstanding, 0);
  assert.equal(b.outstanding, 5);
});

test("autorización acumulada nunca excede el límite", () => {
  let committed = 0;
  const limit = 100;
  for (const desired of [30, 30, 30, 30]) {
    const r = authorizeStock({ desired, committed, limit, longOverdue: 0 });
    committed += r.granted;
    assert.ok(committed <= limit);
  }
  assert.equal(committed, 100);
  const r = authorizeStock({ desired: 50, committed: 40, limit: 100, longOverdue: 10 });
  assert.equal(r.granted, 50);
  const r2 = authorizeStock({ desired: 50, committed: 40, limit: 100, longOverdue: 60 });
  assert.equal(r2.granted, 0);
});

test("límite dinámico: crece con la demanda y nunca queda por debajo de lo comprometido", () => {
  let limit = 100;
  let committed = 90;
  limit = Math.max(limit, 150, committed);
  const r = authorizeStock({ desired: 100, committed, limit });
  assert.equal(r.granted, 60);
  assert.ok(committed + r.granted <= limit);
});

test("cap de categoría reduce la categoría dominante (escenario factible)", () => {
  // 12 afiliados, 4 categorías de 3. Solo la categoría 0 recibe demanda nueva.
  const existing = Array(12).fill(5);
  const desired = [16, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const category = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  const r = applyConcentrationCaps({ existing, desiredNew: desired, category, categoryCap: 0.5 });

  assert.equal(r.feasible, true);
  assert.ok(r.newStock[0] > 0, "la categoría dominante sí recibe autorización (limitada)");
  assert.ok(r.blocked > 0, "parte de la autorización queda bloqueada");
  assert.ok(r.category[0] <= 0.5 + 1e-6, `share categoría ${r.category[0]}`);
  assert.ok(r.category[1] <= 0.5 + 1e-6);
  assert.equal(existing.reduce((a, x) => a + x, 0), 60, "lo existente no se toca");
});

test("caps incompatibles con el reparto se reportan como infactibles", () => {
  // 4 afiliados iguales: top3 <= 60% es imposible (el 4º tendría 40% > top1 25%).
  const r = applyConcentrationCaps({ existing: [0, 0, 0, 0], desiredNew: [10, 10, 10, 10] });
  assert.equal(r.feasible, false);
  assert.equal(r.reason, "caps-incompatibles-con-reparto");
  assert.equal(r.newStock.reduce((a, x) => a + x, 0), 0);
  assert.equal(r.blocked, 40);
});

test("existente que viola caps: recuperación sin revocar lo comprometido", () => {
  // El afiliado 0 concentra el 52.6% de la capacidad ya autorizada.
  const existing = [100, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const before = existing.reduce((a, x) => a + x, 0);
  const r = applyConcentrationCaps({ existing, desiredNew: Array(10).fill(5) });

  assert.equal(r.recovery, true);
  assert.ok(r.blockedEntities.includes(0), "el afiliado dominante queda bloqueado");
  assert.equal(r.newStock[0], 0, "no se autoriza más al dominante");
  assert.ok(r.newStock.slice(1).some((v) => v > 0), "los demás pueden crecer");
  assert.equal(existing.reduce((a, x) => a + x, 0), before, "no se revoca nada");
  assert.ok(r.violationAfter < r.violationBefore, "la concentración mejora");
});

test("caps de concentración bloquean nuevas autorizaciones sin tocar existentes", () => {
  const existing = [50, 50, 0, 0];
  const desired = [50, 0, 50, 50];
  const r = applyConcentrationCaps({ existing, desiredNew: desired });
  assert.ok(r.blocked > 0);
  assert.equal(existing.reduce((a, x) => a + x, 0), 100); // no se toca lo existente
  assert.ok(r.top1 <= 0.5 + 1e-9 || r.newStock[0] === 0);
});
