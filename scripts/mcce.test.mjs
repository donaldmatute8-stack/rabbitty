import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCapacityOptions,
  coverageDaysOf,
  estimateDailyDemand,
  extraordinaryRetention,
  recoverFromGeneratedCapacity,
  roundTo,
  shouldAccelerate,
  validateCapacityAccount,
} from "./lib/mcce.mjs";

test("redondeo a 500", () => {
  assert.equal(roundTo(1234, 500), 1000);
  assert.equal(roundTo(1300, 500), 1500);
  assert.equal(roundTo(750, 500), 1000);
});

test("demanda diaria = ventas × reward × redención", () => {
  assert.equal(
    estimateDailyDemand({ dailyFiatSales: 1000, rewardRate: 0.2, redemptionShare: 0.35 }),
    70
  );
  assert.equal(estimateDailyDemand({ dailyFiatSales: 0 }), 0);
});

test("cobertura en días", () => {
  assert.equal(coverageDaysOf({ capacityAvailable: 7000, dailyRedemption: 1000 }), 7);
  assert.equal(coverageDaysOf({ capacityAvailable: 7000, dailyRedemption: 0 }), null);
});

test("opciones híbridas respetan piso, techo y solvencia", () => {
  const options = buildCapacityOptions({
    dailyCapacityDemand: 100,
    nicheFloor: 1000,
    nicheCeiling: 8000,
    solvencyCap: 5000,
    coverageDays: [7, 14, 30],
    promoShare: 0.4,
  });
  assert.deepEqual(
    options.map((o) => o.totalCapacity),
    [1000, 1500, 3000]
  );
  for (const o of options) {
    assert.equal(o.promoCapacity + o.creditCapacity, o.totalCapacity);
    assert.equal(o.creditCapacity, o.totalCapacity - o.promoCapacity);
  }
});

test("opciones sin solvencia usan el techo del nicho", () => {
  const options = buildCapacityOptions({
    dailyCapacityDemand: 200,
    nicheFloor: 1000,
    nicheCeiling: 6000,
    solvencyCap: Infinity,
    coverageDays: [14],
    promoShare: 0.5,
  });
  assert.equal(options[0].totalCapacity, 3000);
  assert.equal(options[0].promoCapacity, 1500);
  assert.equal(options[0].creditCapacity, 1500);
});

test("recuperación: el valor no se cuenta dos veces", () => {
  const r = recoverFromGeneratedCapacity({
    generatedGross: 1000,
    coverageNeed: 0,
    creditOutstanding: 5000,
    baseAvailable: 5000,
    retainShare: 0.2,
  });
  assert.equal(r.retained, 200);
  assert.equal(r.generatedNet, 800);
  assert.equal(r.generatedGross, r.generatedNet + r.retained);
  assert.equal(r.valueConserved, true);
  assert.equal(r.newCreditOutstanding, 4800);
  assert.equal(r.newAvailable, 5800);
});

test("recuperación: nunca toca la cobertura", () => {
  const r = recoverFromGeneratedCapacity({
    generatedGross: 500,
    coverageNeed: 700,
    creditOutstanding: 5000,
    baseAvailable: 0,
    retainShare: 0.5,
  });
  assert.equal(r.coverageShortfall, 700);
  assert.equal(r.surplus, 0);
  assert.equal(r.retained, 0);
  assert.equal(r.generatedNet, 500);
  assert.equal(r.coverageBlocked, true);

  // Si la capacidad existente ya cubre la cobertura, la nueva es excedente.
  const covered = recoverFromGeneratedCapacity({
    generatedGross: 500,
    coverageNeed: 700,
    creditOutstanding: 5000,
    baseAvailable: 1000,
    retainShare: 0.5,
  });
  assert.equal(covered.coverageShortfall, 0);
  assert.equal(covered.surplus, 500);
  assert.equal(covered.retained, 250);
});

test("recuperación: no retiene más que el compromiso pendiente", () => {
  const r = recoverFromGeneratedCapacity({
    generatedGross: 1000,
    coverageNeed: 0,
    creditOutstanding: 100,
    baseAvailable: 0,
    retainShare: 0.5,
  });
  assert.equal(r.retained, 100);
  assert.equal(r.newCreditOutstanding, 0);
});

test("acelerador exige las tres condiciones", () => {
  assert.equal(
    shouldAccelerate({
      generatedNet: 6000,
      creditOutstanding: 2000,
      coverageDays: 14,
      daysAtTrigger: 60,
    }).accelerate,
    true
  );
  assert.equal(
    shouldAccelerate({
      generatedNet: 6000,
      creditOutstanding: 2000,
      coverageDays: 3,
      daysAtTrigger: 60,
    }).accelerate,
    false
  );
  assert.equal(
    shouldAccelerate({
      generatedNet: 100,
      creditOutstanding: 2000,
      coverageDays: 30,
      daysAtTrigger: 60,
    }).accelerate,
    false
  );
  assert.equal(
    shouldAccelerate({
      generatedNet: 6000,
      creditOutstanding: 0,
      coverageDays: 30,
      daysAtTrigger: 60,
    }).accelerate,
    false
  );
});

test("retención extraordinaria solo sobre excedente", () => {
  const r = extraordinaryRetention({
    generatedGross: 4000,
    coverageNeed: 1000,
    baseAvailable: 0,
    creditOutstanding: 2000,
    extraordinaryShare: 0.5,
  });
  assert.equal(r.surplus, 3000);
  assert.equal(r.retained, 2000);
  assert.equal(r.generatedNet, 2000);
  assert.equal(r.newCreditOutstanding, 0);
});

test("invariantes de la cuenta", () => {
  const ok = {
    creditDisbursed: 3000,
    creditRepaid: 500,
    creditOutstanding: 2500,
    effectiveLimit: 5000,
    capacityCommitted: 1000,
    coverageReserve: 500,
    capacityAvailable: 3500,
    capacityGeneratedGross: 1000,
    capacityGeneratedNet: 800,
  };
  assert.deepEqual(validateCapacityAccount(ok), []);

  const bad = {
    ...ok,
    creditOutstanding: 9999,
    capacityAvailable: -1,
  };
  const errors = validateCapacityAccount(bad);
  assert.ok(errors.length >= 2);
});
