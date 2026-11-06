import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTEMPT_STATUS,
  REASON_CATALOG,
  attemptToRedemption,
  capacityToDataset,
  normalizeReasons,
  pickSources,
} from "./lib/capture-map.mjs";

const branches = new Map([
  ["b1", "a01"],
  ["b2", "a02"],
]);

const attempt = (over = {}) => ({
  id: "at1",
  userHash: "u1",
  branchId: "b1",
  orderId: "o1",
  rewardId: "rw1",
  requestedAt: "2026-11-06T10:00:00Z",
  bunzRequested: 100,
  bunzFulfilled: 0,
  status: "unfulfilled",
  reasons: '["capacity_exhausted"]',
  waitSeconds: 30,
  fulfilledAt: null,
  fulfilledBranchId: null,
  ...over,
});

test("OT-1: un intento se mapea al contrato con sus motivos", () => {
  const r = attemptToRedemption(attempt(), branches);
  assert.equal(r.id, "at1");
  assert.equal(r.requested_affiliate, "a01");
  assert.equal(r.bunz, 100);
  assert.equal(r.fulfilled_bunz, 0);
  assert.equal(r.status, "unfulfilled");
  assert.deepEqual(r.reasons, ["capacity_exhausted"]);
  assert.equal(r.wait_seconds, 30);
});

test("OT-1: motivos fuera del catálogo se normalizan a 'unknown', no se descartan", () => {
  assert.deepEqual(normalizeReasons('["capacity_exhausted","inventado"]'), ["capacity_exhausted", "unknown"]);
  assert.deepEqual(normalizeReasons("no-json"), ["unknown"]);
  assert.deepEqual(normalizeReasons([]), []);
  for (const r of REASON_CATALOG) assert.deepEqual(normalizeReasons([r]), [r]);
});

test("OT-1: estado inválido cae a 'unfulfilled'; el cumplido nunca excede lo pedido", () => {
  const r = attemptToRedemption(attempt({ status: "raro", bunzFulfilled: 500 }), branches);
  assert.equal(r.status, "unfulfilled");
  assert.equal(r.fulfilled_bunz, 100);
  for (const s of ATTEMPT_STATUS) {
    assert.equal(attemptToRedemption(attempt({ status: s }), branches).status, s);
  }
});

test("OT-1: redención cumplida en otra sucursal (movilidad) conserva el origen", () => {
  const r = attemptToRedemption(
    attempt({ status: "fulfilled", bunzFulfilled: 100, fulfilledBranchId: "b2", fulfilledAt: "2026-11-06T10:05:00Z" }),
    branches
  );
  assert.equal(r.requested_affiliate, "a01");
  assert.equal(r.fulfilled_affiliate, "a02");
  assert.equal(r.fulfilled_bunz, 100);
});

test("OT-1: sin sucursal reconocible no se inventa un afiliado", () => {
  assert.equal(attemptToRedemption(attempt({ branchId: "desconocida" }), branches), null);
});

test("OT-4: el snapshot diario se mapea 1:1 con unidades y fecha normalizada", () => {
  const rows = [
    { affiliateId: "a01", date: "2026-11-06T00:00:00Z", authorizedBunz: 500, consumedBunz: 120 },
    { affiliateId: "a02", date: "2026-11-06", authorizedBunz: 300, consumedBunz: 300 },
  ];
  const out = capacityToDataset(rows);
  assert.deepEqual(out[0], { affiliate_id: "a01", date: "2026-11-06", authorized_bunz: 500, consumed_bunz: 120 });
  assert.equal(out[1].consumed_bunz, 300);
});

test("fuentes: sin tablas se declaran huecos; con tablas se usan", () => {
  const sin = pickSources({ hasAttempts: false, hasCapacity: false });
  assert.equal(sin.redemptions, "orders-fallback");
  assert.equal(sin.obligations, "gap");
  assert.equal(sin.ledger, "gap");
  assert.deepEqual(sin.gaps, [
    "bunz_redemption_attempts",
    "bunz_capacity_daily",
    "bunz_obligations",
    "bunz_ledger_entries",
  ]);

  const con = pickSources({ hasAttempts: true, hasCapacity: true, hasObligations: true, hasLedger: true });
  assert.equal(con.redemptions, "attempts");
  assert.equal(con.capacity, "daily-snapshots");
  assert.equal(con.obligations, "db");
  assert.equal(con.ledger, "db");
  assert.deepEqual(con.gaps, []);
});
