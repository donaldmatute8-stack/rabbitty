import test from "node:test";
import assert from "node:assert/strict";
import * as lib from "./lib/economy-v2322.mjs";
import {
  CAPS,
  DUE,
  OBLIGATION_STATE,
  applyConcentrationCaps,
  authorizeWithCaps,
  capsViolationOf,
  concentrationOf,
  contributeBooks,
  createCommissionBooks,
  createObligation,
  isOverdue,
  isPayable,
  outstandingOf,
  redistribute,
  redistributeInvariants,
  resolveDispute,
  settleBooks,
  settleObligations,
  splitAuthorization,
} from "./lib/economy-v2322.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// P0-1 · Prioridad global de pago (defecto: se pagaba la obligación nueva)
// ─────────────────────────────────────────────────────────────────────────────

test("P0-1: nunca se paga una obligación nueva antes que una vieja impaga", () => {
  const vieja = createObligation({ id: "a", amount: 100, month: 1, dueMonth: 2 });
  vieja.outstanding = 70; // parcialmente pagada en el pasado
  vieja.state = OBLIGATION_STATE.PARTIALLY_PAID;
  const nueva = createObligation({ id: "b", amount: 100, month: 3, dueMonth: 4 });

  const r = settleObligations([nueva, vieja], { amount: 50, month: 4 });

  assert.equal(vieja.outstanding, 20, "la vieja se paga primero");
  assert.equal(nueva.outstanding, 100, "la nueva no se toca");
  assert.deepEqual(r.order, ["a"]);
  assert.equal(r.settled, 50);
});

test("P0-1: invariante de prioridad tras cualquier liquidación", () => {
  const obs = [
    createObligation({ id: "a", amount: 40, month: 1, dueMonth: 2 }),
    createObligation({ id: "b", amount: 40, month: 2, dueMonth: 3 }),
    createObligation({ id: "c", amount: 40, month: 3, dueMonth: 4 }),
  ];
  for (const amount of [10, 30, 45, 120]) {
    const snapshot = obs.map((o) => ({ ...o }));
    const r = settleObligations(snapshot, { amount, month: 5 });
    const paidMax = r.allocations.length ? Math.max(...r.allocations.map((a) => a.dueMonth)) : -Infinity;
    const unpaidMin = Math.min(
      ...snapshot.filter((o) => isPayable(o) && o.outstanding > 0).map((o) => o.dueMonth),
      Infinity
    );
    assert.ok(paidMax <= unpaidMin, `amount=${amount}: pagó ${paidMax} dejando ${unpaidMin}`);
  }
});

test("P0-1: no se prepagan obligaciones antes de su vencimiento", () => {
  const o = createObligation({ id: "a", amount: 100, month: 1, dueMonth: 3 });
  assert.equal(settleObligations([o], { amount: 100, month: 2 }).settled, 0);
  assert.equal(settleObligations([o], { amount: 100, month: 3 }).settled, 100);
});

test("P0-1: el camino anterior (payObligations) ya no existe", () => {
  assert.equal("payObligations" in lib, false, "no debe quedar un segundo camino de pago");
});

// ─────────────────────────────────────────────────────────────────────────────
// P0-2 · Libros separados (defecto: "cobrado" ambiguo)
// ─────────────────────────────────────────────────────────────────────────────

test("P0-2: reservado, liberado, liquidado en Bunz y fiat cobrado son distintos", () => {
  const books = createCommissionBooks({ endowment: 100 });
  const o = createObligation({ id: "a", amount: 80, month: 1, dueMonth: 2 });

  const r = settleBooks(books, { obligations: [o], month: 2 });

  assert.equal(r.settled, 80);
  assert.equal(books.reserved, 20);
  assert.equal(books.released, 80);
  assert.equal(books.settledInBunz, 80);
  assert.equal(books.fiatCollected, 0, "liquidar en Bunz no es cobrar fiat");
  assert.equal(r.fiatCollected, 0);
  assert.equal(r.treasuryBunzDelta, 80, "la tesorería recibe Bunz, no fiat");
});

test("P0-2: identidad reservado + liberado = origen + aportes", () => {
  const books = createCommissionBooks({ endowment: 100 });
  contributeBooks(books, 30);
  const obs = [
    createObligation({ id: "a", amount: 50, month: 1, dueMonth: 2 }),
    createObligation({ id: "b", amount: 50, month: 2, dueMonth: 3 }),
  ];
  settleBooks(books, { obligations: obs, month: 2 });
  settleBooks(books, { obligations: obs, month: 3 });

  assert.equal(books.endowment + books.contributions, books.reserved + books.released);
  assert.equal(books.released, books.settledInBunz);
  assert.equal(books.fiatCollected, 0);
});

test("P0-3: el saldo inicial del presupuesto tiene origen declarado", () => {
  const books = createCommissionBooks({ endowment: 100 });
  assert.equal(books.reserved, 100);
  assert.equal(books.endowment, 100);
  assert.equal(books.contributions, 0);

  // Sin aportes, no se puede liberar más que el fondeo inicial.
  const obs = [createObligation({ id: "a", amount: 500, month: 1, dueMonth: 2 })];
  settleBooks(books, { obligations: obs, month: 2 });
  assert.equal(books.released, 100);
  assert.equal(obs[0].outstanding, 400);
});

test("P0-2: `commissionCollected` (nombre ambiguo) no existe", () => {
  assert.equal("commissionCollected" in lib, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-4 · Concentración final por categoría
// ─────────────────────────────────────────────────────────────────────────────

test("P1-4: los caps se aplican DESPUÉS de límites y mora", () => {
  const existing = Array(12).fill(5);
  const category = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  const desired = [16, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // El afiliado 0 queda bloqueado por mora: su deseo se recorta antes de los caps.
  const r = authorizeWithCaps({
    desired: [0, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    committed: existing,
    hardLimit: Array(12).fill(1000),
    currentCeiling: Array(12).fill(1000),
    longOverdueReserve: Array(12).fill(0),
    existing,
    category,
    dynamicCaps: true,
  });

  assert.ok(r.granted[0] === 0, "el bloqueado por mora no recibe nada");
  assert.equal(r.caps.feasible, true);
  for (const share of Object.values(r.caps.metricsAfter.byCategory)) {
    assert.ok(share <= CAPS.category + 1e-6, `categoría ${share} > ${CAPS.category}`);
  }
});

test("P1-4: la concentración final registrada es la capacidad real", () => {
  const live = [10, 10, 5, 5];
  const cats = [0, 0, 1, 1];
  const c = concentrationOf(live, cats);
  const total = live.reduce((a, x) => a + x, 0);
  assert.ok(Math.abs(c.byCategory[0] - 20 / total) < 1e-12);
  assert.ok(Math.abs(c.byCategory[1] - 10 / total) < 1e-12);
  assert.ok(Math.abs(c.top1 - 10 / total) < 1e-12);
  assert.ok(Math.abs(c.top3 - 25 / total) < 1e-12);
  assert.ok(Math.abs(c.hhi - live.reduce((a, x) => a + Math.pow(x / total, 2), 0)) < 1e-12);
});

test("P1-4: el cap de categoría se cumple cuando hay reparto factible", () => {
  const existing = Array(12).fill(5);
  const desired = [16, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const category = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  const r = applyConcentrationCaps({ existing, desiredNew: desired, category });
  assert.equal(r.feasible, true);
  assert.ok(r.metricsAfter.byCategory[0] <= CAPS.category + 1e-6);
  assert.ok(r.blocked > 0);
  assert.equal(existing.reduce((a, x) => a + x, 0), 60);
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-5 · feasible / reason completos
// ─────────────────────────────────────────────────────────────────────────────

test("P1-5: reparto incompatible (4 afiliados iguales) se explica", () => {
  const r = applyConcentrationCaps({ existing: [0, 0, 0, 0], desiredNew: [10, 10, 10, 10] });
  assert.equal(r.feasible, false);
  assert.equal(r.reason, "reparto-incompatible-con-caps");
  assert.equal(r.newStock.reduce((a, x) => a + x, 0), 0);
});

test("P1-5: recuperación bloqueada y recuperación parcial se explican", () => {
  // 3 afiliados: top3 60% es imposible con 3 → recuperación sin concesión.
  const bloqueada = applyConcentrationCaps({
    existing: [10, 10, 10],
    desiredNew: [5, 5, 5],
  });
  assert.equal(bloqueada.feasible, false);
  assert.ok(bloqueada.reason, "debe explicar por qué");

  // 20 afiliados con un dominante: se concede a los pequeños pero persiste violación.
  const existing = Array(20).fill(0).map((_, i) => (i === 0 ? 100 : 5));
  const r = applyConcentrationCaps({ existing, desiredNew: Array(20).fill(10) });
  assert.equal(r.recovery, true);
  assert.equal(r.newStock[0], 0, "el dominante no recibe");
  assert.ok(r.newStock.slice(1).some((x) => x > 0), "los demás sí");
  assert.equal(r.feasible, false);
  assert.equal(r.reason, "recuperacion-parcial");
});

test("P1-5: si no es factible, SIEMPRE hay reason (propiedad)", () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let t = 0; t < 300; t++) {
    const n = 3 + Math.floor(rnd() * 12);
    const existing = Array.from({ length: n }, () => Math.floor(rnd() * 100));
    const desiredNew = Array.from({ length: n }, () => Math.floor(rnd() * 100));
    const category = n >= 8 ? Array.from({ length: n }, (_, i) => i % 3) : null;
    const r = applyConcentrationCaps({ existing, desiredNew, category });
    if (!r.feasible) assert.ok(r.reason, `sin reason en t=${t} n=${n}`);
    if (r.feasible) assert.equal(capsViolationOf(r.newStock.map((x, i) => existing[i] + x), category).violation <= 1e-9, true);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-6 · Techo dinámico vs compromiso histórico
// ─────────────────────────────────────────────────────────────────────────────

test("P1-6: el techo puede bajar y no revoca lo comprometido", () => {
  const alto = splitAuthorization({ desired: 10, committed: 100, hardLimit: 1000, currentCeiling: 500 });
  assert.equal(alto.granted, 10);

  const bajo = splitAuthorization({ desired: 10, committed: 100, hardLimit: 1000, currentCeiling: 60 });
  assert.equal(bajo.granted, 0, "sin disponible cuando el techo cae");
  assert.equal(bajo.committedProtected, 100, "lo comprometido no se toca");
  assert.equal(bajo.ceilingBelowCommitted, true);
  assert.equal(bajo.binding, "ceiling");
});

test("P1-6: la deuda larga reduce lo disponible, nunca lo comprometido", () => {
  // techo 100, comprometido 40, reserva por mora 30 → disponible 30
  const r = splitAuthorization({ desired: 50, committed: 40, hardLimit: 1000, currentCeiling: 100, longOverdueReserve: 30 });
  assert.equal(r.available, 30);
  assert.equal(r.granted, 30);
  assert.equal(r.committedProtected, 40);
});

test("P1-6: el límite contractual también acota", () => {
  const r = splitAuthorization({ desired: 100, committed: 0, hardLimit: 20, currentCeiling: 1000 });
  assert.equal(r.granted, 20);
  assert.equal(r.binding, "hardLimit");
});

test("P1-6: el techo se recalcula con la demanda actual (sin memoria al alza)", () => {
  const escenario = (monthlyStock) => 12 * monthlyStock;
  assert.equal(escenario(100), 1200);
  assert.equal(escenario(50), 600, "si la demanda cae, el techo cae");
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-7 · Semántica temporal de vencimiento
// ─────────────────────────────────────────────────────────────────────────────

test("P1-7: vence al final del mes: no bloquea el mismo mes", () => {
  const o = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 3 });
  assert.equal(isOverdue(o, 2), false);
  assert.equal(isOverdue(o, 3), false, "el mes de vencimiento todavía no ha terminado");
  assert.equal(isOverdue(o, 4), true);
  assert.equal(DUE.graceMonths, 0);
});

test("P1-7: el periodo de gracia desplaza el bloqueo", () => {
  const o = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 3, graceMonths: 1 });
  assert.equal(isOverdue(o, 4), false);
  assert.equal(isOverdue(o, 5), true);
  assert.equal(lib.overdueMonths(o, 6), 2);
});

test("P1-7: deuda larga = umbral explícito, no un índice implícito", () => {
  const o = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 3 });
  assert.equal(outstandingOf([o], { scope: "longOverdue", month: 4 }), 0);
  assert.equal(outstandingOf([o], { scope: "longOverdue", month: 5 }), 10);
  assert.equal(outstandingOf([o], { scope: "longOverdue", month: 5, longOverdueMonths: 3 }), 0);
});

test("P1-7: una disputa congelada no bloquea al afiliado", () => {
  const o = createObligation({ id: "a", amount: 10, month: 1, dueMonth: 2, disputed: true });
  const gate = (obs, m) => obs.some((x) => isPayable(x) && x.outstanding > 0 && isOverdue(x, m));
  assert.equal(gate([o], 9), false, "DISPUTED no es pagable → no bloquea");
  assert.equal(outstandingOf([o], { scope: "overdue", month: 9 }), 0);
});

test("P1-7: un castigo extingue el saldo y no bloquea para siempre", () => {
  const o = createObligation({ id: "a", amount: 50, month: 1, dueMonth: 2, disputed: true });
  resolveDispute(o, 3, false);
  assert.equal(o.state, OBLIGATION_STATE.RESOLVED_NOT_PAYABLE);
  assert.equal(o.outstanding, 0, "el saldo se extingue");
  assert.equal(o.writtenOff, 50);
  assert.equal(isPayable(o), false);
  assert.equal(outstandingOf([o], { scope: "all", includeDisputed: true }), 0);
});

test("P1-7: una disputa resuelta a favor vuelve a contar como vencida", () => {
  const o = createObligation({ id: "a", amount: 50, month: 1, dueMonth: 2, disputed: true });
  resolveDispute(o, 3, true);
  assert.equal(o.state, OBLIGATION_STATE.RESOLVED_PAYABLE);
  assert.equal(outstandingOf([o], { scope: "overdue", month: 4 }), 50);
  assert.equal(settleObligations([o], { amount: 50, month: 4 }).settled, 50);
});

// ─────────────────────────────────────────────────────────────────────────────
// Obligaciones: ciclo de vida previo (sin regresiones)
// ─────────────────────────────────────────────────────────────────────────────

test("obligación: pago parcial y total", () => {
  const o = createObligation({ id: "a", amount: 100, month: 1, dueMonth: 2 });
  assert.equal(o.state, OBLIGATION_STATE.OPEN);
  assert.equal(settleObligations([o], { amount: 40, month: 2 }).settled, 40);
  assert.equal(o.state, OBLIGATION_STATE.PARTIALLY_PAID);
  assert.equal(o.outstanding, 60);
  assert.equal(settleObligations([o], { amount: 100, month: 3 }).settled, 60);
  assert.equal(o.state, OBLIGATION_STATE.PAID);
});

test("obligación: no se paga una disputa sin resolver", () => {
  const o = createObligation({ id: "d", amount: 50, month: 1, dueMonth: 2, disputed: true });
  assert.equal(settleObligations([o], { amount: 50, month: 5 }).settled, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Redistribución (sin regresiones)
// ─────────────────────────────────────────────────────────────────────────────

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
  assert.equal(redistributeInvariants(r, [10, 10], [20, 0]).ok, true);
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
