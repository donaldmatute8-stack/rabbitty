#!/usr/bin/env node
/**
 * ── Bunz Economy v2.3.2 — Validación corregida ─────────────────────────────
 * SOLO SIMULACIÓN. No toca DB, producción, tasas, saldos, stock ni tesorería.
 *
 * Correcciones frente a v2.3.1:
 *  - Redistribución real entre afiliados (origen → destino), no índices locales.
 *  - unmet_local vs unmet_ecosystem; movilidad nula / parcial / perfecta.
 *  - Obligaciones con ciclo de vida (OPEN, DISPUTED, RESOLVED_*, PARTIALLY_PAID, PAID).
 *  - Resolución de disputa cambia el estado y afecta vencimientos.
 *  - maxAuthorizable ACUMULADO, consumido por paquetes; deuda larga reduce lo disponible.
 *  - Caps dinámicos de concentración (top1/top3/HHI/categoría) sobre nuevas autorizaciones.
 *  - Libros de comisión con semántica explícita (Bunz, sin conversión implícita).
 *  - Reconciliación de unmet, reasignación, disputas y castigos.
 */

import {
  OBLIGATION_STATE,
  applyConcentrationCaps,
  authorizeStock,
  createObligation,
  outstandingOf,
  payObligations,
  redistribute,
  resolveDispute,
  sum,
} from "./lib/economy-v232.mjs";

const N = 20;
const MONTHS = 12;
const TOTAL_FIAT = 1_000_000;
const GROWTH = 0.03;
const C_REWARD = 0.03;
const C_FIAT = 0.06;
const C_REDEEM = 0.02;
const RESERVE = 100_000;
const BONUS_SHARE = 0.3;
const BURN_SHARE = 0.2;
const DEFAULT = {
  rewardRate: 0.2,
  redemptionRate: 0.5,
  expectedRedemptionRatio: 0.2,
  coverageDays: 45,
  buffer: 1.1,
  packageScale: 1,
  mobility: 1,
  disputedShare: 0,
  disputeMonths: 2,
  disputeFavorable: 0.5,
  dynamicCaps: false,
  crossShare: 0.3,
  fiatMultiplier: 1,
  authorizationMonths: 12,
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uniform = () => Array(N).fill(1 / N);
const concentrated = () => {
  const s = Array(N).fill(0.2 / (N - 3));
  s[0] = 0.3; s[1] = 0.28; s[2] = 0.22;
  return s;
};
const cappedConcentrated = () => {
  const s = Array(N).fill(0.4 / (N - 3));
  s[0] = 0.25; s[1] = 0.2; s[2] = 0.15;
  return s;
};
const categoryConcentrated = () => {
  // Los 10 mayores por capacidad pertenecen a la categoría 0
  const cats = Array(N).fill(1);
  for (let i = 0; i < 10; i++) cats[i] = 0;
  return cats;
};
const concentratedTail = () => {
  const s = Array(N).fill(0.2 / (N - 3));
  s[N - 1] = 0.3; s[N - 2] = 0.28; s[N - 3] = 0.22;
  return s;
};

function run(sc) {
  const cfg = { ...DEFAULT, ...sc };
  const demand = sc.demand ?? uniform();
  const capacity = sc.capacity ?? demand;
  const redemption = sc.redemption ?? demand;
  const rng = mulberry32(sc.seed ?? 42);

  const totalStock0 = demand.reduce(
    (a, d) => a + (cfg.coverageDays / 30) * (TOTAL_FIAT * d * cfg.expectedRedemptionRatio) * cfg.packageScale,
    0
  );
  const totalIssuance0 = demand.reduce(
    (a, d) => a + TOTAL_FIAT * d * cfg.rewardRate * cfg.buffer * cfg.packageScale,
    0
  );
  const totalCommission0 = demand.reduce(
    (a, d) =>
      a +
      (TOTAL_FIAT * d * C_FIAT + TOTAL_FIAT * d * cfg.expectedRedemptionRatio * C_REDEEM) *
        cfg.packageScale,
    0
  );

  const categories = sc.category ?? Array.from({ length: N }, (_, i) => i % 4);
  const businesses = Array.from({ length: N }, (_, i) => {
    const initialStock = totalStock0 * capacity[i] * 0.5;
    return {
      id: i,
      demand: demand[i],
      capacity: capacity[i],
      redemption: redemption[i],
      category: categories[i],
      sInitial: initialStock,
      sPromo: 0,
      issuance: totalIssuance0 * capacity[i] * 0.5,
      commissionBudget: totalCommission0 * capacity[i] * 0.5,
      authorizationLimit: totalStock0 * capacity[i] * 12,
      authorizedCumulative: initialStock,
      obligations: [],
      commissionAccrued: 0,
      commissionCollected: 0,
      writtenOff: 0,
      emitted: 0,
      served: 0,
      lastServedMonth: 0,
    };
  });

  let C = 0;
  let T = 0;
  let emitted = 0;
  let redeemed = 0;
  let requestedTotal = 0;
  let servedTotal = 0;
  let unmetLocalTotal = 0;
  let unmetEcosystemTotal = 0;
  let reassignedTotal = 0;
  let blockingReassigned = 0;
  let fiatTotal = 0;
  let rewardsTotal = 0;
  let fiatCommTotal = 0;
  let redeemCommTotal = 0;
  let writtenOffTotal = 0;
  let blockedStockTotal = 0;
  let recoveryMonths = 0;
  let capViolationEnd = 0;
  let capBlockedEntities = 0;
  let checks = 0;
  const failures = [];
  const history = [];

  const sumB = (key) => businesses.reduce((a, b) => a + b[key], 0);
  const check = (name, expected, actual) => {
    checks++;
    if (Math.abs(expected - actual) > 0.02) {
      failures.push({ name, expected, actual, diff: expected - actual });
    }
  };

  for (let m = 1; m <= MONTHS; m++) {
    const start = {
      C,
      T,
      issuance: sumB("issuance"),
      budget: sumB("commissionBudget"),
      accrued: sumB("commissionAccrued"),
      collected: sumB("commissionCollected"),
      writtenOff: sumB("writtenOff"),
      sInitial: sumB("sInitial"),
      sPromo: sumB("sPromo"),
      authorized: sumB("authorizedCumulative"),
    };

    const fiatMonth = TOTAL_FIAT * cfg.fiatMultiplier * Math.pow(1 + GROWTH, m - 1);
    fiatTotal += fiatMonth;

    let rewardsMonth = 0;
    let rewardsNetMonth = 0;
    let rewardCommissionMonth = 0;
    let servedMonth = 0;
    let servedInitialMonth = 0;
    let servedPromoMonth = 0;
    let fiatPaidMonth = 0;
    let redeemPaidMonth = 0;
    let packagePaidMonth = 0;
    let fiatAccruedMonth = 0;
    let redeemAccruedMonth = 0;
    let packageNetMonth = 0;
    let packageStockMonth = 0;
    let packageIssuanceMonth = 0;
    let writtenOffMonth = 0;
    let bonusMonth = 0;
    let compMonth = 0;
    let burnMonth = 0;
    let blockedStockMonth = 0;
    let requestedMonth = 0;
    let servedMonthTotal = 0;
    let unmetLocalMonth = 0;
    let unmetEcosystemMonth = 0;
    let reassignedMonth = 0;
    let violationEndOfMonth = 0;

    // 1) Resolver disputas cuyo plazo llegó
    for (const b of businesses) {
      for (const o of b.obligations) {
        if (o.state !== OBLIGATION_STATE.DISPUTED) continue;
        if (m < o.createdMonth + cfg.disputeMonths) continue;
        const payable = rng() < cfg.disputeFavorable;
        resolveDispute(o, m, payable);
        if (!payable) {
          b.writtenOff += o.writtenOff;
          writtenOffMonth += o.writtenOff;
        }
      }
    }

    // 2) Reposición MIRE + autorización acumulada + caps dinámicos
    const paused = cfg.pauseFrom !== undefined && m >= cfg.pauseFrom && m <= cfg.pauseTo;
    const noPackages = cfg.noPackagesAfter !== undefined && m > cfg.noPackagesAfter;
    if (!paused && !noPackages && cfg.packageScale > 0) {
      const totalStockMonth = demand.reduce(
        (a, d) => a + (cfg.coverageDays / 30) * (fiatMonth * d * cfg.expectedRedemptionRatio),
        0
      );
      const totalIssuanceMonth = demand.reduce(
        (a, d) => a + fiatMonth * d * cfg.rewardRate * cfg.buffer,
        0
      );
      const totalCommissionMonth = demand.reduce(
        (a, d) => a + fiatMonth * d * C_FIAT + fiatMonth * d * cfg.expectedRedemptionRatio * C_REDEEM,
        0
      );

      let desiredStock = businesses.map((b) => totalStockMonth * b.capacity);
      if (cfg.dynamicCaps) {
        const capped = applyConcentrationCaps({
          existing: businesses.map((b) => b.sInitial + b.sPromo),
          desiredNew: desiredStock,
          category: businesses.map((b) => b.category),
        });
        desiredStock = capped.newStock;
        blockedStockMonth += capped.blocked;
        if (capped.recovery) recoveryMonths++;
        capBlockedEntities = Math.max(capBlockedEntities, capped.blockedEntities.length);
      }

      if (cfg.dynamicCaps) {
        // violación de caps sobre la capacidad viva al cierre del mes
        const live = businesses.map((b) => b.sInitial + b.sPromo);
        const tot = live.reduce((a, x) => a + x, 0);
        if (tot > 0) {
          const sortedLive = [...live].sort((a, b) => b - a);
          const v1 = sortedLive[0] / tot - 0.25;
          const v3 = sortedLive.slice(0, 3).reduce((a, x) => a + x, 0) / tot - 0.6;
          const s2 = live.reduce((a, x) => a + x * x, 0);
          const vh = Math.sqrt(s2 / (tot * tot)) - Math.sqrt(0.15);
          violationEndOfMonth = Math.max(0, v1, v3, vh);
        }
      }

      businesses.forEach((b, i) => {
        const overdue = outstandingOf(b.obligations, { overdue: true, month: m });
        const longOverdue = outstandingOf(b.obligations, { longOverdue: true, month: m });

        // Límite acumulado dinámico: se recalcula con la demanda actual.
        // Nunca baja de lo ya comprometido (no revoca).
        const currentMonthlyStock = totalStockMonth * b.capacity;
        b.authorizationLimit = Math.max(
          b.authorizationLimit,
          cfg.authorizationMonths * currentMonthlyStock,
          b.authorizedCumulative
        );

        const auth = authorizeStock({
          desired: desiredStock[i],
          committed: b.authorizedCumulative,
          limit: b.authorizationLimit,
          longOverdue,
        });
        blockedStockMonth += auth.blocked;

        const stockFinal = overdue > 0 ? 0 : auth.granted;
        b.sInitial += stockFinal;
        b.authorizedCumulative += stockFinal;
        packageStockMonth += stockFinal;

        const issuanceFinal = overdue > 0 ? 0 : totalIssuanceMonth * b.capacity;
        b.issuance += issuanceFinal;
        packageIssuanceMonth += issuanceFinal;

        const allocation = totalCommissionMonth * b.capacity;
        const paidPkg = payObligations(b.obligations, allocation, m);
        b.commissionBudget += allocation - paidPkg;
        b.commissionCollected += paidPkg;
        packagePaidMonth += paidPkg;
        packageNetMonth += allocation - paidPkg;
        T += paidPkg;
      });
    }

    // 3) Recompensas: doble autorización + bloqueo por deuda vencida
    for (const b of businesses) {
      const fiatB = fiatMonth * b.demand;
      const requested = fiatB * cfg.rewardRate;
      const overdue = outstandingOf(b.obligations, { overdue: true, month: m });
      const capacityNow = b.sInitial + b.sPromo;
      let granted = Math.min(requested, b.issuance, capacityNow);
      if (overdue > 0) granted = 0;
      b.issuance -= granted;
      b.emitted += granted;
      rewardsMonth += granted;
      rewardsNetMonth += granted * (1 - C_REWARD);
      rewardCommissionMonth += granted * C_REWARD;
      C += granted * (1 - C_REWARD);
      T += granted * C_REWARD;
      emitted += granted;
    }

    // 4) Comisión fiat (obligación individual)
    for (const b of businesses) {
      const fiatB = fiatMonth * b.demand;
      const fee = fiatB * C_FIAT;
      fiatCommTotal += fee;
      fiatAccruedMonth += fee;
      const disputed = cfg.disputedShare > 0 && rng() < cfg.disputedShare;
      const ob = createObligation({
        id: `${b.id}-${m}-fiat`,
        amount: fee,
        month: m,
        dueMonth: m + 1,
        disputed,
      });
      b.obligations.push(ob);
      b.commissionAccrued += fee;
      if (!disputed) {
        const last = ob;
        const paid = payObligations([last], Math.min(fee, b.commissionBudget), m);
        b.commissionBudget -= paid;
        b.commissionCollected += paid;
        fiatPaidMonth += paid;
        T += paid;
      }
    }

    // 5) Redención con redistribución real y movilidad
    const target = Math.min(C, C * cfg.redemptionRate);
    const requested = businesses.map((b) => target * b.redemption);
    const capacityNow = businesses.map((b) => b.sInitial + b.sPromo);
    const dist = redistribute({ requested, capacity: capacityNow, mobility: cfg.mobility });

    businesses.forEach((b, i) => {
      const take = dist.served[i];
      if (take > 0) {
        const fromInitial = Math.min(b.sInitial, take);
        const fromPromo = take - fromInitial;
        b.sInitial -= fromInitial;
        b.sPromo -= fromPromo;
        servedInitialMonth += fromInitial;
        servedPromoMonth += fromPromo;
        servedMonth += take;
        b.served += take;
        b.lastServedMonth = m;
        C -= take;
        const fee = take * C_REDEEM;
        redeemCommTotal += fee;
        redeemAccruedMonth += fee;
        const disputed = cfg.disputedShare > 0 && rng() < cfg.disputedShare;
        const ob = createObligation({
          id: `${b.id}-${m}-redeem`,
          amount: fee,
          month: m,
          dueMonth: m + 1,
          disputed,
        });
        b.obligations.push(ob);
        b.commissionAccrued += fee;
        if (!disputed) {
          const last = ob;
          const paid = payObligations([last], Math.min(fee, b.commissionBudget), m);
          b.commissionBudget -= paid;
          b.commissionCollected += paid;
          redeemPaidMonth += paid;
          T += paid;
        }
      }
    });

    requestedMonth = dist.totalRequested;
    servedMonthTotal = dist.totalServed;
    unmetLocalMonth = dist.totalUnmetLocal;
    unmetEcosystemMonth = dist.totalUnmetEcosystem;
    reassignedMonth = dist.totalReassigned;
    const servedLocalMonth = dist.servedLocal.reduce((a, x) => a + x, 0);
    requestedTotal += requestedMonth;
    servedTotal += servedMonthTotal;
    unmetLocalTotal += unmetLocalMonth;
    unmetEcosystemTotal += unmetEcosystemMonth;
    reassignedTotal += reassignedMonth;
    blockingReassigned += dist.totalReassigned;
    redeemed += servedMonthTotal;

    // 6) Tesorería
    const excess = Math.max(0, T - RESERVE);
    if (excess > 0) {
      const bonus = excess * BONUS_SHARE;
      const burn = excess * BURN_SHARE;
      T -= bonus;
      C += bonus;
      bonusMonth += bonus;
      const comp = bonus * 0.5;
      const per = comp / N;
      for (const b of businesses) b.sInitial += per;
      T -= comp;
      compMonth += comp;
      T -= burn;
      burnMonth += burn;
    }

    // 7) Métricas y reconciliación
    const bcdByBiz = businesses.map((b) => Math.max(0, b.sInitial + b.sPromo));
    const bcd = bcdByBiz.reduce((a, x) => a + x, 0);
    const claims = C + Math.max(0, T);
    const ce = claims > 0 ? bcd / claims : Infinity;
    const overdue = businesses.reduce((a, b) => a + outstandingOf(b.obligations, { overdue: true, month: m }), 0);
    const disputed = businesses.reduce(
      (a, b) =>
        a +
        outstandingOf(b.obligations, { includeDisputed: true }) -
        outstandingOf(b.obligations, {}),
      0
    );
    const outstanding = businesses.reduce(
      (a, b) => a + outstandingOf(b.obligations, { includeDisputed: true }),
      0
    );
    const sorted = [...bcdByBiz].sort((a, b) => b - a);
    const top1 = bcd > 0 ? sorted[0] / bcd : 0;
    const top3 = bcd > 0 ? sorted.slice(0, 3).reduce((a, x) => a + x, 0) / bcd : 0;
    const hhi = bcd > 0 ? bcdByBiz.reduce((a, x) => a + Math.pow(x / bcd, 2), 0) : 0;
    const activeServed = businesses.filter((b) => b.lastServedMonth === m).length;
    const activeEmitted = businesses.filter((b) => b.emitted > 0).length;

    check("C", start.C + rewardsNetMonth + bonusMonth - servedMonth, C);
    check(
      "T",
      start.T + rewardCommissionMonth + fiatPaidMonth + redeemPaidMonth + packagePaidMonth - bonusMonth - compMonth - burnMonth,
      T
    );
    check("issuance", start.issuance + packageIssuanceMonth - rewardsMonth, sumB("issuance"));
    check(
      "budget",
      start.budget + packageNetMonth - fiatPaidMonth - redeemPaidMonth,
      sumB("commissionBudget")
    );
    check("accrued", start.accrued + fiatAccruedMonth + redeemAccruedMonth, sumB("commissionAccrued"));
    check(
      "collected",
      start.collected + fiatPaidMonth + redeemPaidMonth + packagePaidMonth,
      sumB("commissionCollected")
    );
    check("writtenOff", start.writtenOff + writtenOffMonth, sumB("writtenOff"));
    check(
      "outstanding",
      sumB("commissionAccrued") - sumB("commissionCollected") - sumB("writtenOff"),
      outstanding
    );
    check("sInitial", start.sInitial + packageStockMonth + compMonth - servedInitialMonth, sumB("sInitial"));
    check("sPromo", start.sPromo - servedPromoMonth, sumB("sPromo"));
    check("requested", servedMonthTotal + unmetEcosystemMonth, requestedMonth);
    // Lo atendido localmente + lo reasignado debe ser exactamente lo servido:
    // la capacidad reasignada se contabiliza una sola vez.
    check("served-local+reassigned", servedLocalMonth + reassignedMonth, servedMonthTotal);
    // Lo servido debe consumir exactamente el stock inicial + promocional.
    check("stock-consumido=servido", servedInitialMonth + servedPromoMonth, servedMonthTotal);
    businesses.forEach((b) => check("auth<=limit", 0, Math.max(0, b.authorizedCumulative - b.authorizationLimit)));

    blockedStockTotal += blockedStockMonth;
    history.push({
      month: m,
      C: Math.round(C),
      bcd: Math.round(bcd),
      ce: Number(ce.toFixed(3)),
      T: Math.round(T),
      overdue: Math.round(overdue),
      disputed: Math.round(disputed),
      outstanding: Math.round(outstanding),
      issuance: Math.round(sumB("issuance")),
      budget: Math.round(sumB("commissionBudget")),
      accrued: Math.round(sumB("commissionAccrued")),
      collected: Math.round(sumB("commissionCollected")),
      requested: Math.round(requestedMonth),
      served: Math.round(servedMonthTotal),
      unmetLocal: Math.round(unmetLocalMonth),
      unmetEcosystem: Math.round(unmetEcosystemMonth),
      reassigned: Math.round(reassignedMonth),
      blocked: Math.round(blockedStockMonth),
      capViolation: cfg.dynamicCaps ? Number(violationEndOfMonth.toFixed(4)) : 0,
      top1: Number(top1.toFixed(3)),
      top3: Number(top3.toFixed(3)),
      hhi: Number(hhi.toFixed(3)),
      activeServed,
      activeEmitted,
      emitted: Math.round(rewardsMonth),
    });

    rewardsTotal += rewardsMonth;
  }

  const last = history[history.length - 1];
  capViolationEnd = last.capViolation ?? 0;
  return {
    label: sc.label,
    history,
    checks,
    failures,
    summary: {
      label: sc.label,
      ce: last.ce,
      C: last.C,
      bcd: last.bcd,
      T: last.T,
      overdue: last.overdue,
      disputed: last.disputed,
      outstanding: last.outstanding,
      issuance: last.issuance,
      budget: last.budget,
      accrued: last.accrued,
      collected: last.collected,
      requested: last.requested,
      served: last.served,
      unmetLocal: last.unmetLocal,
      unmetEcosystem: last.unmetEcosystem,
      reassigned: last.reassigned,
      blocked: Math.round(blockedStockTotal),
      recoveryMonths,
      capViolationEnd: last.capViolation,
      capBlockedEntities,
      top1: last.top1,
      top3: last.top3,
      hhi: last.hhi,
      writtenOff: Math.round(sumB("writtenOff")),
      activeServed: last.activeServed,
      activeEmitted: last.activeEmitted,
      emitted: Math.round(emitted),
      redeemed: Math.round(redeemed),
      merchantContribution: Math.round(
        (fiatTotal - rewardsTotal - fiatCommTotal - redeemCommTotal) / N
      ),
    },
  };
}

// ── Escenarios ──────────────────────────────────────────────────────────────
const scen = [
  { label: "Base alineado", demand: uniform(), capacity: uniform() },
  { label: "Demanda conc./cap. dist. (mob 1)", demand: concentrated(), capacity: uniform(), mobility: 1 },
  { label: "Demanda conc./cap. dist. (mob 0.5)", demand: concentrated(), capacity: uniform(), mobility: 0.5 },
  { label: "Demanda conc./cap. dist. (mob 0)", demand: concentrated(), capacity: uniform(), mobility: 0 },
  { label: "Demanda dist./cap. conc.", demand: uniform(), capacity: concentrated() },
  { label: "Demanda conc./cap. conc.", demand: concentrated(), capacity: concentrated() },
  { label: "Desalineado", demand: concentrated(), capacity: concentratedTail() },
  { label: "Capacidad capeada (estática)", demand: concentrated(), capacity: cappedConcentrated() },
  { label: "Caps dinámicos", demand: concentrated(), capacity: concentrated(), dynamicCaps: true },
  { label: "Caps + categoría conc.", demand: concentrated(), capacity: concentrated(), dynamicCaps: true, category: categoryConcentrated() },
  { label: "Sin paquetes", demand: uniform(), capacity: uniform(), noPackagesAfter: 0 },
  { label: "Pausa 3m (4-6)", demand: uniform(), capacity: uniform(), pauseFrom: 4, pauseTo: 6 },
  { label: "Disputa 20% (resolución 50%)", demand: uniform(), capacity: uniform(), disputedShare: 0.2 },
  { label: "Estrés total", demand: concentrated(), capacity: concentrated(), noPackagesAfter: 2, rewardRate: 0.1, redemptionRate: 0.8 },
  { label: "Emisión cero", demand: uniform(), capacity: uniform(), rewardRate: 0 },
  { label: "Redención cero", demand: uniform(), capacity: uniform(), redemptionRate: 0 },
  { label: "Demanda x2", demand: uniform(), capacity: uniform(), fiatMultiplier: 2 },
];

const results = scen.map((s) => run(s));

console.log(`\nBunz Economy v2.3.2 — ${MONTHS} meses, ${N} negocios\n`);
console.log(
  "Escenario".padEnd(40),
  "CE".padStart(7),
  "Circ".padStart(9),
  "Capac".padStart(10),
  "Deuda".padStart(9),
  "UnmetE".padStart(8),
  "UnmetL".padStart(8),
  "Reasig".padStart(8),
  "Top1".padStart(6),
  "Top3".padStart(6),
  "HHI".padStart(6),
  "ActS".padStart(5)
);
console.log("-".repeat(125));
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(40),
    String(s.ce).padStart(7),
    String(s.C).padStart(9),
    String(s.bcd).padStart(10),
    String(s.overdue).padStart(9),
    String(s.unmetEcosystem).padStart(8),
    String(s.unmetLocal).padStart(8),
    String(s.reassigned).padStart(8),
    String(s.top1).padStart(6),
    String(s.top3).padStart(6),
    String(s.hhi).padStart(6),
    String(s.activeServed).padStart(5)
  );
}

console.log("\nLibros (mes 12):");
console.log(
  "Escenario".padEnd(40),
  "Deveng".padStart(9),
  "Cobrado".padStart(9),
  "Presup".padStart(9),
  "Disputa".padStart(9),
  "Castigo".padStart(9),
  "Tesorería".padStart(10),
  "Bloq".padStart(9)
);
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(40),
    String(s.accrued).padStart(9),
    String(s.collected).padStart(9),
    String(s.budget).padStart(9),
    String(s.disputed).padStart(9),
    String(s.writtenOff ?? 0).padStart(9),
    String(s.T).padStart(10),
    String(s.blocked).padStart(9)
  );
}

const checks = results.reduce((a, r) => a + r.checks, 0);
const failures = results.flatMap((r) => r.failures.map((f) => ({ scenario: r.label, ...f })));
console.log(`\nReconciliación: ${checks} checks, ${failures.length} fallos.`);
if (failures.length) console.table(failures.slice(0, 15));

// ── Sensibilidad 48 (reward × redemption × packageScale) ──────────────────
const grid = [];
for (const rewardRate of [0.1, 0.2, 0.5, 1.0]) {
  for (const redemptionRate of [0.3, 0.5, 0.8]) {
    for (const packageScale of [0, 0.5, 1, 1.5]) {
      const r = run({
        label: `r${rewardRate}-red${redemptionRate}-pkg${packageScale}`,
        demand: uniform(),
        capacity: uniform(),
        rewardRate,
        redemptionRate,
        packageScale,
      });
      grid.push({
        rewardRate,
        redemptionRate,
        packageScale,
        ce: Number.isFinite(r.summary.ce) ? r.summary.ce : null,
        C: r.summary.C,
        bcd: r.summary.bcd,
        T: r.summary.T,
        overdue: r.summary.overdue,
        outstanding: r.summary.outstanding,
        unmetEcosystem: r.summary.unmetEcosystem,
        unmetLocal: r.summary.unmetLocal,
        reassigned: r.summary.reassigned,
        served: r.summary.served,
        requested: r.summary.requested,
        emitted: r.summary.emitted,
        budget: r.summary.budget,
        collected: r.summary.collected,
        activeServed: r.summary.activeServed,
        activeEmitted: r.summary.activeEmitted,
        top1: r.summary.top1,
        top3: r.summary.top3,
        hhi: r.summary.hhi,
        blocked: r.summary.blocked,
      });
    }
  }
}
const active = grid.filter((g) => Number.isFinite(g.ce) && g.activeServed > 0);
const byUnmet = [...active].sort((a, b) => a.unmetEcosystem - b.unmetEcosystem);
console.log("\nSensibilidad (48 combinaciones):");
console.log("Mejor unmet:", byUnmet[0]);
console.log("Peor unmet:", byUnmet[byUnmet.length - 1]);
const byDebt = [...grid].sort((a, b) => b.overdue - a.overdue);
console.log("Mayor deuda:", byDebt[0]);

function detail(name) {
  const r = results.find((x) => x.label.includes(name));
  console.log(`\nDetalle: ${r.label}`);
  console.log(
    "Mes".padStart(4),
    "Circ".padStart(9),
    "Capac".padStart(9),
    "CE".padStart(6),
    "Deuda".padStart(8),
    "UnmetE".padStart(8),
    "Reasig".padStart(8),
    "Bloq".padStart(8),
    "Top3".padStart(6)
  );
  for (const h of r.history) {
    console.log(
      String(h.month).padStart(4),
      String(h.C).padStart(9),
      String(h.bcd).padStart(9),
      String(h.ce).padStart(6),
      String(h.overdue).padStart(8),
      String(h.unmetEcosystem).padStart(8),
      String(h.reassigned).padStart(8),
      String(h.blocked).padStart(8),
      String(h.top3).padStart(6)
    );
  }
}
if (process.env.SIM_JSON) {
  console.log(
    "JSONRESULT:" +
      JSON.stringify({
        months: MONTHS,
        businesses: N,
        checks,
        failures: failures.length,
        scenarios: results.map((r) => r.summary),
        sensitivity: grid,
      })
  );
}

detail("Sin paquetes");
detail("Caps dinámicos");
detail("Caps + categoría conc.");
detail("Demanda conc./cap. dist. (mob 0)");
