import test from "node:test";
import assert from "node:assert/strict";
import {
  balancesByAccount,
  ledgerEntryToDataset,
  ledgerToDataset,
  obligationToDataset,
  obligationsToDataset,
  summarizeObligations,
  unbalancedGroups,
} from "./lib/econ-books-map.mjs";

const ob = (over = {}) => ({
  id: "ob1",
  affiliateId: "a01",
  origin: "fiat_sale",
  accruedAt: "2026-10-01T00:00:00Z",
  dueAt: "2026-10-31T00:00:00Z",
  amountBunz: 200,
  state: "OPEN",
  settledAt: null,
  instrument: null,
  settledBunz: 0,
  settledFiatMxn: 0,
  writtenOffAt: null,
  ...over,
});

const entry = (over = {}) => ({
  id: "l1",
  groupId: "g1",
  ts: "2026-10-01T00:00:00Z",
  account: "emission_budget",
  direction: "debit",
  amount: 100,
  refType: "reward",
  refId: "rw1",
  ...over,
});

test("OT-2: obligación válida se mapea al contrato", () => {
  const r = obligationToDataset(ob());
  assert.equal(r.ok, true);
  assert.deepEqual(r.row, {
    id: "ob1",
    affiliate_id: "a01",
    origin: "fiat_sale",
    accrued_at: "2026-10-01",
    due_at: "2026-10-31",
    bunz: 200,
    state: "OPEN",
    settled_at: null,
    instrument: null,
    settled_bunz: 0,
    settled_fiat_mxn: 0,
    written_off_at: null,
  });
});

test("OT-2: estado u origen inválidos se rechazan, no se corrigen en silencio", () => {
  assert.equal(obligationToDataset(ob({ state: "RARO" })).ok, false);
  assert.equal(obligationToDataset(ob({ origin: "otro" })).ok, false);
  assert.equal(obligationToDataset(ob({ instrument: "bitcoin" })).ok, false);
});

test("OT-2: no se acepta liquidar más Bunz que el importe", () => {
  const r = obligationToDataset(ob({ settledBunz: 201 }));
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes("settled_bunz"));
});

test("OT-2: las filas inválidas se reportan aparte, sin romper el lote", () => {
  const { rows, invalid } = obligationsToDataset([ob(), ob({ id: "ob2", state: "X" })]);
  assert.equal(rows.length, 1);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].id, "ob2");
});

test("OT-2: resumen separa Bunz de MXN y calcula vencido", () => {
  const rows = [
    { bunz: 200, settled_bunz: 200, settled_fiat_mxn: 0, state: "PAID", due_at: "2026-09-01" },
    { bunz: 100, settled_bunz: 0, settled_fiat_mxn: 50, state: "PARTIALLY_PAID", due_at: "2026-09-01" },
    { bunz: 80, settled_bunz: 0, settled_fiat_mxn: 0, state: "OPEN", due_at: "2026-12-01" },
    { bunz: 60, settled_bunz: 0, settled_fiat_mxn: 0, state: "RESOLVED_NOT_PAYABLE", due_at: "2026-09-01" },
    { bunz: 40, settled_bunz: 0, settled_fiat_mxn: 0, state: "DISPUTED", due_at: "2026-09-01" },
  ];
  const s = summarizeObligations(rows, { today: new Date("2026-11-06T00:00:00Z"), longOverdueDays: 30 });
  assert.equal(s.accrued, 480);
  assert.equal(s.settledBunz, 200);
  assert.equal(s.settledFiat, 50);
  assert.equal(s.writtenOff, 60);
  assert.equal(s.disputed, 40);
  // pendiente incluye disputas (contrato); el vencido NO incluye la disputa
  assert.equal(s.outstanding, 170);
  assert.equal(s.overdue, 50);
});

test("OT-3: asiento válido se mapea; cuenta o dirección inválidas se rechazan", () => {
  const r = ledgerEntryToDataset(entry());
  assert.equal(r.ok, true);
  assert.equal(r.row.account, "emission_budget");
  assert.equal(ledgerEntryToDataset(entry({ account: "banco" })).ok, false);
  assert.equal(ledgerEntryToDataset(entry({ direction: "up" })).ok, false);
  assert.equal(ledgerEntryToDataset(entry({ amount: 0 })).ok, false);
});

test("OT-3: un grupo descuadrado se detecta", () => {
  const entries = [
    ledgerEntryToDataset(entry({ id: "a", groupId: "g1", account: "emission_budget", direction: "debit", amount: 10 })).row,
    ledgerEntryToDataset(entry({ id: "b", groupId: "g1", account: "user_wallet", direction: "credit", amount: 9 })).row,
  ];
  const bad = unbalancedGroups(entries);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].group, "g1");
});

test("OT-3: los saldos se calculan créditos − débitos", () => {
  const entries = [
    { account: "emission_budget", direction: "debit", amount: 100 },
    { account: "user_wallet", direction: "credit", amount: 100 },
    { account: "user_wallet", direction: "debit", amount: 40 },
    { account: "redemption_capacity", direction: "credit", amount: 40 },
  ];
  const b = balancesByAccount(entries);
  assert.equal(b.user_wallet, 60);
  assert.equal(b.emission_budget, -100);
  assert.equal(b.redemption_capacity, 40);
});

test("OT-3: el lote reporta inválidos sin romper", () => {
  const { rows, invalid } = ledgerToDataset([
    entry(),
    entry({ id: "l2", account: "nope" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(invalid.length, 1);
});
