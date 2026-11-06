#!/usr/bin/env node
/**
 * ── economy-sim v2.3 — AUDITORÍA ──────────────────────────────────────────
 * Mismo modelo de 4 cubos que v2.3, con:
 *  - reconciliación por cubo, mes a mes (C, T, deuda, emisión, comisión, stock)
 *  - métricas de concentración (top-3, HHI)
 *  - presupuesto de emisión/comisión restante
 *
 * Determinista. No toca DB ni código de producción.
 */

const MONTHS = 12;
const BUSINESSES = 20;
const FIAT = 50000;
const GROWTH = 0.03;
const C_REWARD = 0.03;
const C_FIAT = 0.06;
const C_REDEEM = 0.02;
const CROSS = 0.3;
const INITIAL = { stock: 30000, issuance: 20000, commission: 10000 };
const PACKAGE = { stock: 15000, issuance: 10000, commission: 5000 };
const RESERVE = 100000;
const BONUS_SHARE = 0.3;
const BURN_SHARE = 0.2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);

function shares(concentration) {
  if (!concentration) return Array(BUSINESSES).fill(1 / BUSINESSES);
  const s = Array(BUSINESSES).fill(0.2 / Math.max(1, BUSINESSES - 3));
  s[0] = 0.3; s[1] = 0.28; s[2] = 0.22;
  return s;
}

function run(sc) {
  const {
    rewardRate = 0.2,
    redemptionRate = 0.5,
    replenish = true,
    pauseFrom = null,
    pauseTo = null,
    concentration = false,
    unpaid = 0,
    issuanceScale = 1,
    label,
  } = sc;

  const businesses = shares(concentration).map((share, i) => ({
    id: i, share,
    sInitial: INITIAL.stock,
    sPromo: 0,
    issuance: INITIAL.issuance * issuanceScale,
    commission: INITIAL.commission,
    debt: 0,
    fiat: 0,
    rewards: 0,
    redeemed: 0,
    requestedRewards: 0,
    commissions: 0,
  }));

  let C = 0;
  let T = 0;
  let fiatTotal = 0;
  let rewardsTotal = 0;
  let requestedTotal = 0;
  let fiatCommTotal = 0;
  let redeemCommTotal = 0;
  let redeemedTotal = 0;
  let clearingExposure = 0;
  let auditChecks = 0;
  const auditFailures = [];
  const history = [];

  const sum = (key) => businesses.reduce((a, b) => a + b[key], 0);
  const check = (labelCheck, expected, actual) => {
    auditChecks++;
    if (Math.abs(expected - actual) > 0.01) {
      auditFailures.push({ label: labelCheck, expected, actual, diff: expected - actual });
    }
  };

  for (let m = 1; m <= MONTHS; m++) {
    const start = {
      C, T,
      debt: sum("debt"),
      issuance: sum("issuance"),
      commission: sum("commission"),
      sInitial: sum("sInitial"),
      sPromo: sum("sPromo"),
    };

    const fiatMonth = FIAT * BUSINESSES * Math.pow(1 + GROWTH, m - 1);
    fiatTotal += fiatMonth;

    let rewardsMonth = 0;
    let rewardsNetMonth = 0;
    let rewardCommissionMonth = 0;
    let requestedMonth = 0;
    let redeemedMonth = 0;
    let redeemedInitialMonth = 0;
    let redeemedPromoMonth = 0;
    let fiatPaidMonth = 0;
    let fiatUnpaidMonth = 0;
    let redeemPaidMonth = 0;
    let redeemUnpaidMonth = 0;
    let bonusMonth = 0;
    let compMonth = 0;
    let burnMonth = 0;
    let packageStockMonth = 0;
    let packageIssuanceMonth = 0;
    let packageCommissionNetMonth = 0;
    let payDebtMonth = 0;

    // 1) Fiat + recompensas (dos autorizaciones; NO crean capacidad)
    for (const b of businesses) {
      const fiat = fiatMonth * b.share;
      b.fiat += fiat;
      const requested = fiat * rewardRate;
      const capacity = b.sInitial + b.sPromo;
      let granted = Math.min(requested, b.issuance, capacity);
      if (b.debt > 0) granted = 0;
      b.issuance -= granted;
      b.rewards += granted;
      b.requestedRewards += requested;
      requestedMonth += requested;
      rewardsMonth += granted;
      rewardsNetMonth += granted * (1 - C_REWARD);
      rewardCommissionMonth += granted * C_REWARD;
      C += granted * (1 - C_REWARD);
      T += granted * C_REWARD;

      const fee = fiat * C_FIAT;
      b.commissions += fee;
      fiatCommTotal += fee;
      const skipped = unpaid > 0 && rng() < unpaid;
      const paid = skipped ? 0 : Math.min(fee, b.commission);
      b.commission -= paid;
      b.debt += fee - paid;
      fiatPaidMonth += paid;
      fiatUnpaidMonth += fee - paid;
      T += paid;
    }

    // 2) Política de tesorería
    const excess = Math.max(0, T - RESERVE);
    if (excess > 0) {
      const bonus = excess * BONUS_SHARE;
      const burn = excess * BURN_SHARE;
      T -= bonus;
      C += bonus;
      bonusMonth += bonus;
      const comp = bonus * 0.5;
      const perBiz = comp / BUSINESSES;
      for (const b of businesses) b.sInitial += perBiz;
      T -= comp;
      compMonth += comp;
      T -= burn;
      burnMonth += burn;
    }

    // 3) Redenciones
    let target = Math.min(C, C * redemptionRate);
    let remaining = target;
    for (let pass = 0; pass < 2 && remaining > 0.01; pass++) {
      for (const b of businesses) {
        if (remaining <= 0.01) break;
        const available = b.sInitial + b.sPromo;
        if (available <= 0) continue;
        const want = Math.min(remaining * b.share * (pass === 0 ? 1 : 2), available);
        if (want <= 0) continue;
        const fromInitial = Math.min(b.sInitial, want);
        const fromPromo = Math.max(0, want - fromInitial);
        b.sInitial -= fromInitial;
        b.sPromo -= fromPromo;
        b.redeemed += want;
        redeemedMonth += want;
        redeemedInitialMonth += fromInitial;
        redeemedPromoMonth += fromPromo;
        remaining -= want;
        C -= want;
        const fee = want * C_REDEEM;
        redeemCommTotal += fee;
        const paid = Math.min(fee, b.commission);
        b.commission -= paid;
        b.debt += fee - paid;
        redeemPaidMonth += paid;
        redeemUnpaidMonth += fee - paid;
        T += paid;
      }
    }
    redeemedTotal += redeemedMonth;
    clearingExposure += redeemedMonth * CROSS;

    // 4) Paquete mensual
    const paused = pauseFrom !== null && m >= pauseFrom && m <= pauseTo;
    if (replenish && !paused) {
      for (const b of businesses) {
        b.sInitial += PACKAGE.stock;
        packageStockMonth += PACKAGE.stock;
        const allocation = PACKAGE.commission;
        const payDebt = Math.min(b.debt, allocation);
        b.debt -= payDebt;
        b.commission += allocation - payDebt;
        packageCommissionNetMonth += allocation - payDebt;
        payDebtMonth += payDebt;
        b.issuance += PACKAGE.issuance * issuanceScale;
        packageIssuanceMonth += PACKAGE.issuance * issuanceScale;
      }
    }

    const bcd = businesses.reduce((a, b) => a + Math.max(0, b.sInitial + b.sPromo), 0);
    const claims = C + Math.max(0, T);
    const ce = claims > 0 ? bcd / claims : Infinity;
    const unbacked = Math.max(0, claims - bcd);
    const active = businesses.filter((b) => b.sInitial + b.sPromo > 1).length;

    const bcdByBusiness = businesses
      .map((b) => Math.max(0, b.sInitial + b.sPromo))
      .sort((a, b) => b - a);
    const top3 = bcd > 0 ? bcdByBusiness.slice(0, 3).reduce((a, n) => a + n, 0) / bcd : 0;
    const hhi = bcd > 0
      ? businesses.reduce((acc, b) => acc + Math.pow(Math.max(0, b.sInitial + b.sPromo) / bcd, 2), 0)
      : 0;

    // ── Reconciliación ────────────────────────────────────────────────────
    check("C", start.C + rewardsNetMonth + bonusMonth - redeemedMonth, C);
    check(
      "T",
      start.T + rewardCommissionMonth + fiatPaidMonth + redeemPaidMonth - bonusMonth - compMonth - burnMonth,
      T
    );
    check("debt", start.debt + fiatUnpaidMonth + redeemUnpaidMonth - payDebtMonth, sum("debt"));
    check("issuance", start.issuance + packageIssuanceMonth - rewardsMonth, sum("issuance"));
    check(
      "commission",
      start.commission + packageCommissionNetMonth - fiatPaidMonth - redeemPaidMonth,
      sum("commission")
    );
    check("sInitial", start.sInitial + packageStockMonth + compMonth - redeemedInitialMonth, sum("sInitial"));
    check("sPromo", start.sPromo - redeemedPromoMonth, sum("sPromo"));

    history.push({
      month: m,
      circulation: Math.round(C),
      capacity: Math.round(bcd),
      treasury: Math.round(T),
      debt: Math.round(sum("debt")),
      issuance: Math.round(sum("issuance")),
      commission: Math.round(sum("commission")),
      ce: Number(ce.toFixed(3)),
      unbacked: Math.round(unbacked),
      active,
      top3: Number(top3.toFixed(3)),
      hhi: Number(hhi.toFixed(3)),
      rewards: Math.round(rewardsMonth),
      requested: Math.round(requestedMonth),
      redeemed: Math.round(redeemedMonth),
    });

    rewardsTotal += rewardsMonth;
    requestedTotal += requestedMonth;
    fiatCommTotal += 0;
    redeemCommTotal += 0;
  }

  const last = history[history.length - 1];
  return {
    label,
    history,
    audit: { checks: auditChecks, failures: auditFailures },
    summary: {
      label,
      ce: last.ce,
      unbacked: last.unbacked,
      circulation: last.circulation,
      capacity: last.capacity,
      treasury: last.treasury,
      debt: last.debt,
      issuance: last.issuance,
      commission: last.commission,
      active: last.active,
      top3: last.top3,
      hhi: last.hhi,
      rewards: Math.round(rewardsTotal),
      requested: Math.round(requestedTotal),
      redeemed: Math.round(redeemedTotal),
      clearing: Math.round(clearingExposure),
      merchantContribution: Math.round(
        (fiatTotal - rewardsTotal - fiatCommTotal - redeemCommTotal) / BUSINESSES
      ),
    },
  };
}

const scenarios = [
  { label: "Base (rew 20%, canje 50%)", rewardRate: 0.2, redemptionRate: 0.5 },
  { label: "Reward 10%", rewardRate: 0.1, redemptionRate: 0.5 },
  { label: "Reward 100%", rewardRate: 1.0, redemptionRate: 0.5 },
  { label: "Canje 3x (150%)", rewardRate: 0.2, redemptionRate: 1.5 },
  { label: "Sin paquetes 12m", rewardRate: 0.2, redemptionRate: 0.5, replenish: false },
  { label: "Pausa 3m (4-6)", rewardRate: 0.2, redemptionRate: 0.5, pauseFrom: 4, pauseTo: 6 },
  { label: "Concentración 80/3", rewardRate: 0.2, redemptionRate: 0.5, concentration: true },
  { label: "Comisiones impagas 30%", rewardRate: 0.2, redemptionRate: 0.5, unpaid: 0.3 },
  { label: "Presupuesto emisión 50%", rewardRate: 0.2, redemptionRate: 0.5, issuanceScale: 0.5 },
];

const results = scenarios.map(run);

console.log(`\nBunz Economy Sim v2.3 AUDIT — ${MONTHS} meses, ${BUSINESSES} negocios\n`);
console.log(
  "Escenario".padEnd(30),
  "CE".padStart(7),
  "UNBACKED".padStart(9),
  "Circ".padStart(9),
  "Capac".padStart(10),
  "Deuda".padStart(9),
  "Emisión".padStart(9),
  "Comisión".padStart(9),
  "Top3".padStart(6),
  "HHI".padStart(6),
  "Act".padStart(4)
);
console.log("-".repeat(118));
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(30),
    String(s.ce).padStart(7),
    String(s.unbacked).padStart(9),
    String(s.circulation).padStart(9),
    String(s.capacity).padStart(10),
    String(s.debt).padStart(9),
    String(s.issuance).padStart(9),
    String(s.commission).padStart(9),
    String(s.top3).padStart(6),
    String(s.hhi).padStart(6),
    String(s.active).padStart(4)
  );
}

const totalChecks = results.reduce((a, r) => a + r.audit.checks, 0);
const failures = results.flatMap((r) => r.audit.failures.map((f) => ({ scenario: r.label, ...f })));
console.log(`\nReconciliación: ${totalChecks} checks, ${failures.length} fallos.`);
if (failures.length) {
  console.table(failures.slice(0, 20));
}

function detail(name) {
  const r = results.find((x) => x.label.includes(name));
  console.log(`\nDetalle: ${r.label}`);
  console.log(
    "Mes".padStart(4),
    "Circ".padStart(9),
    "Capac".padStart(9),
    "CE".padStart(7),
    "Deuda".padStart(8),
    "Emisión".padStart(9),
    "Comisión".padStart(9),
    "Top3".padStart(6),
    "Act".padStart(4),
    "Rewards".padStart(9)
  );
  for (const h of r.history) {
    console.log(
      String(h.month).padStart(4),
      String(h.circulation).padStart(9),
      String(h.capacity).padStart(9),
      String(h.ce).padStart(7),
      String(h.debt).padStart(8),
      String(h.issuance).padStart(9),
      String(h.commission).padStart(9),
      String(h.top3).padStart(6),
      String(h.active).padStart(4),
      String(h.rewards).padStart(9)
    );
  }
}

detail("Sin paquetes");
detail("Concentración");
