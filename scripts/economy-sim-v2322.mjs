#!/usr/bin/env node
/**
 * ── Bunz Economy v2.3.2.2 — Cierre de inconsistencias semánticas ────────────
 * SOLO SIMULACIÓN. No toca DB, producción, tasas, saldos, stock ni tesorería.
 *
 * Cambios frente a v2.3.2.1 (auditoría 2026-11-06):
 *  P0-1  Un único camino de pago (`settleObligations`) sobre TODAS las
 *        obligaciones del afiliado, con prioridad global por antigüedad.
 *  P0-2  Libros separados: budgetReserved, budgetReleased,
 *        obligationSettledInBunz, commissionFiatCollected, treasuryBunz,
 *        treasuryFiat. `commissionCollected` desaparece como nombre ambiguo.
 *  P0-3  Origen del saldo inicial del presupuesto documentado y reconciliado
 *        (`budgetEndowment`).
 *  P1-4  Concentración final medida por afiliado, categoría y mes sobre la
 *        capacidad REAL; los caps se aplican DESPUÉS de límites y mora.
 *  P1-5  `feasible`/`reason` completos en todos los casos.
 *  P1-6  `committed` (protegido) separado de `currentCeiling` (recalculable,
 *        puede bajar) y de `hardLimit` (contractual, provisional).
 *  P1-7  Semántica temporal única: vence al final de `dueMonth` (+ grace).
 *  P2    `crossShare` eliminado: clearing no se implementa, no se configura.
 */

import {
  CAPS,
  DUE,
  OBLIGATION_STATE,
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
  resolveDispute,
  settleBooks,
  sum,
} from "./lib/economy-v2322.mjs";

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

/**
 * HIPÓTESIS, no decisión aprobada: qué es pagar una obligación desde el
 * presupuesto. Aquí se modela como reclasificación interna de Bunz.
 * Alternativas abiertas: conversión Bunz→fiat, compensación, ingreso efectivo.
 */
const SETTLEMENT_MODE = "internal_bunz_reclassification";
const FIAT_SETTLEMENT_MODELED = false;

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
  fiatMultiplier: 1,
  authorizationMonths: 12,
  hardLimitMonths: 36, // provisional, NO aprobado
  graceMonths: DUE.graceMonths,
  longOverdueMonths: DUE.longOverdueMonths,
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
      (TOTAL_FIAT * d * C_FIAT + TOTAL_FIAT * d * cfg.expectedRedemptionRatio * C_REDEEM) * cfg.packageScale,
    0
  );

  const categories = sc.category ?? Array.from({ length: N }, (_, i) => i % 4);

  const businesses = Array.from({ length: N }, (_, i) => {
    const initialStock = totalStock0 * capacity[i] * 0.5;
    // ORIGEN del saldo inicial del presupuesto: fondeo del paquete por el
    // afiliado (50% del presupuesto mensual de comisión del primer mes).
    const budgetEndowment = totalCommission0 * capacity[i] * 0.5;
    return {
      id: i,
      demand: demand[i],
      capacity: capacity[i],
      redemption: redemption[i],
      category: categories[i],

      // capacidad
      sInitial: initialStock,
      sPromo: 0,
      issuance: totalIssuance0 * capacity[i] * 0.5,

      // autorización: tres magnitudes distintas
      authorizedCommitted: initialStock, // protegido, nunca se revoca
      hardAuthorizationLimit: cfg.hardLimitMonths * totalStock0 * capacity[i], // contractual
      currentAuthorizationCeiling: cfg.authorizationMonths * totalStock0 * capacity[i], // recalculable

      // libros de comisión (nombres separados, sin ambigüedad)
      books: createCommissionBooks({ endowment: budgetEndowment }),
      commissionAccrued: 0,
      fiatAccrued: 0,
      bunzAccrued: 0,
      writtenOff: 0,

      obligations: [],
      emitted: 0,
      served: 0,
      lastServedMonth: 0,
      ceilingBelowCommittedMonths: 0,
    };
  });

  let C = 0;
  let treasuryBunz = 0;
  // Caja fiat: el simulador NO la modela. Se declara para que cualquier intento
  // de escribirla rompa la reconciliación en vez de pasar desapercibido.
  const treasuryFiat = 0;
  const commissionFiatCollected = 0;
  let emitted = 0;
  let redeemed = 0;
  let requestedTotal = 0;
  let servedTotal = 0;
  let unmetLocalTotal = 0;
  let unmetEcosystemTotal = 0;
  let reassignedTotal = 0;
  let fiatTotal = 0;
  let rewardsTotal = 0;
  let fiatCommTotal = 0;
  let redeemCommTotal = 0;
  let blockedStockTotal = 0;
  let blockedByCapsTotal = 0;
  let blockedByLimitTotal = 0;
  let recoveryMonths = 0;
  let capsInfeasibleMonths = 0;
  let capReasonMonths = {};
  let capBlockedEntities = 0;
  let priorityViolations = 0;
  let checks = 0;
  const failures = [];
  const history = [];

  const sumB = (key) => businesses.reduce((a, b) => a + b[key], 0);
  const sumBooks = (key) => businesses.reduce((a, b) => a + b.books[key], 0);
  const check = (name, expected, actual) => {
    checks++;
    if (Math.abs(expected - actual) > 0.02) {
      failures.push({ name, expected, actual, diff: expected - actual });
    }
  };

  for (let m = 1; m <= MONTHS; m++) {
    const start = {
      C,
      T: treasuryBunz,
      issuance: sumB("issuance"),
      reserved: sumBooks("reserved"),
      released: sumBooks("released"),
      settledInBunz: sumBooks("settledInBunz"),
      accrued: sumB("commissionAccrued"),
      writtenOff: sumB("writtenOff"),
      sInitial: sumB("sInitial"),
      sPromo: sumB("sPromo"),
      committed: sumB("authorizedCommitted"),
      endowment: sumBooks("endowment"),
    };

    const fiatMonth = TOTAL_FIAT * cfg.fiatMultiplier * Math.pow(1 + GROWTH, m - 1);
    fiatTotal += fiatMonth;

    let rewardsMonth = 0;
    let rewardsNetMonth = 0;
    let rewardCommissionMonth = 0;
    let servedMonth = 0;
    let servedInitialMonth = 0;
    let servedPromoMonth = 0;
    let settledMonth = 0;
    let fiatAccruedMonth = 0;
    let redeemAccruedMonth = 0;
    let contributionsMonth = 0;
    let packageStockMonth = 0;
    let packageIssuanceMonth = 0;
    let writtenOffMonth = 0;
    let bonusMonth = 0;
    let compMonth = 0;
    let burnMonth = 0;
    let blockedCapsMonth = 0;
    let blockedLimitMonth = 0;
    let requestedMonth = 0;
    let servedMonthTotal = 0;
    let unmetLocalMonth = 0;
    let unmetEcosystemMonth = 0;
    let reassignedMonth = 0;
    let violationEndOfMonth = 0;
    let categoryViolationEndOfMonth = 0;
    let grantedTotalMonth = 0;
    let availableTotalMonth = 0;
    let authForMonth = null;

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

    const paused = cfg.pauseFrom !== undefined && m >= cfg.pauseFrom && m <= cfg.pauseTo;
    const noPackages = cfg.noPackagesAfter !== undefined && m > cfg.noPackagesAfter;
    const packagesActive = !paused && !noPackages && cfg.packageScale > 0;

    // 2) Devengo de comisión fiat (obligación nace en el mes)
    for (const b of businesses) {
      const fee = fiatMonth * b.demand * C_FIAT;
      fiatCommTotal += fee;
      fiatAccruedMonth += fee;
      const disputed = cfg.disputedShare > 0 && rng() < cfg.disputedShare;
      const ob = createObligation({
        id: `${b.id}-${m}-fiat`,
        amount: fee,
        month: m,
        dueMonth: m + 1,
        disputed,
        graceMonths: cfg.graceMonths,
      });
      b.obligations.push(ob);
      b.commissionAccrued += fee;
      b.fiatAccrued += fee;
    }

    // 3) Paquete: límites primero, caps después (sobre lo realmente autorizable)
    if (packagesActive) {
      const totalStockMonth = demand.reduce(
        (a, d) => a + (cfg.coverageDays / 30) * (fiatMonth * d * cfg.expectedRedemptionRatio),
        0
      );
      const totalIssuanceMonth = demand.reduce((a, d) => a + fiatMonth * d * cfg.rewardRate * cfg.buffer, 0);
      const totalCommissionMonth = demand.reduce(
        (a, d) => a + fiatMonth * d * C_FIAT + fiatMonth * d * cfg.expectedRedemptionRatio * C_REDEEM,
        0
      );

      const liveBefore = businesses.map((b) => b.sInitial + b.sPromo);
      const desiredRaw = businesses.map((b) => totalStockMonth * b.capacity);

      // 3a) mora + techo dinámico + compromiso protegido, y 3b) caps DESPUÉS.
      const longOverdueReserve = businesses.map((b) =>
        outstandingOf(b.obligations, {
          scope: "longOverdue",
          month: m,
          longOverdueMonths: cfg.longOverdueMonths,
        })
      );
      const currentCeilings = businesses.map((b) => {
        const monthlyStock = totalStockMonth * b.capacity;
        b.currentAuthorizationCeiling = cfg.authorizationMonths * monthlyStock; // puede BAJAR
        if (b.currentAuthorizationCeiling < b.authorizedCommitted) b.ceilingBelowCommittedMonths++;
        return b.currentAuthorizationCeiling;
      });

      authForMonth = authorizeWithCaps({
        desired: businesses.map((b, i) => (overdueGate(b, m) ? 0 : desiredRaw[i])),
        committed: businesses.map((b) => b.authorizedCommitted),
        hardLimit: businesses.map((b) => b.hardAuthorizationLimit),
        currentCeiling: currentCeilings,
        longOverdueReserve,
        existing: liveBefore,
        category: businesses.map((b) => b.category),
        dynamicCaps: cfg.dynamicCaps,
      });

      grantedTotalMonth += sum(authForMonth.granted);
      availableTotalMonth += sum(authForMonth.splits.map((x) => x.available));
      blockedLimitMonth += authForMonth.blockedByLimit;
      blockedCapsMonth += authForMonth.blockedByCaps;
      if (authForMonth.caps) {
        if (authForMonth.caps.recovery) recoveryMonths++;
        if (!authForMonth.caps.feasible) {
          capsInfeasibleMonths++;
          capReasonMonths[authForMonth.caps.reason] = (capReasonMonths[authForMonth.caps.reason] || 0) + 1;
        }
        capBlockedEntities = Math.max(capBlockedEntities, authForMonth.caps.offending.length);
      }
      const grantedStock = authForMonth.granted;

      businesses.forEach((b, i) => {
        const stockFinal = grantedStock[i];
        b.sInitial += stockFinal;
        b.authorizedCommitted += stockFinal;
        packageStockMonth += stockFinal;

        // La emisión (capacidad nueva) sí se bloquea por mora.
        if (!overdueGate(b, m)) {
          const issuanceFinal = totalIssuanceMonth * b.capacity;
          b.issuance += issuanceFinal;
          packageIssuanceMonth += issuanceFinal;
        }

        // La contribución al presupuesto de comisión es el pago de comisiones
        // sobre las ventas del mes: NO se bloquea por mora. Bloquearla haría
        // que la deuda vencida fuera impagable (espiral de bloqueo).
        const contribution = totalCommissionMonth * b.capacity;
        contributeBooks(b.books, contribution);
        contributionsMonth += contribution;
      });
    }

    // 4) Emisión de recompensas (bloqueada por mora)
    for (const b of businesses) {
      const fiatB = fiatMonth * b.demand;
      const requested = fiatB * cfg.rewardRate;
      const capacityNow = b.sInitial + b.sPromo;
      let granted = Math.min(requested, b.issuance, capacityNow);
      if (overdueGate(b, m)) granted = 0;
      b.issuance -= granted;
      b.emitted += granted;
      rewardsMonth += granted;
      rewardsNetMonth += granted * (1 - C_REWARD);
      rewardCommissionMonth += granted * C_REWARD;
      C += granted * (1 - C_REWARD);
      treasuryBunz += granted * C_REWARD;
      emitted += granted;
    }

    // 5) Redención con redistribución y movilidad
    const target = Math.min(C, C * cfg.redemptionRate);
    const req = businesses.map((b) => target * b.redemption);
    const capNow = businesses.map((b) => b.sInitial + b.sPromo);
    const dist = redistribute({ requested: req, capacity: capNow, mobility: cfg.mobility });

    businesses.forEach((b, i) => {
      const take = dist.served[i];
      if (take <= 0) return;
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
        graceMonths: cfg.graceMonths,
      });
      b.obligations.push(ob);
      b.commissionAccrued += fee;
      b.bunzAccrued += fee;
    });

    requestedMonth = dist.totalRequested;
    servedMonthTotal = dist.totalServed;
    unmetLocalMonth = dist.totalUnmetLocal;
    unmetEcosystemMonth = dist.totalUnmetEcosystem;
    reassignedMonth = dist.totalReassigned;
    requestedTotal += requestedMonth;
    servedTotal += servedMonthTotal;
    unmetLocalTotal += unmetLocalMonth;
    unmetEcosystemTotal += unmetEcosystemMonth;
    reassignedTotal += reassignedMonth;
    redeemed += servedMonthTotal;
    const servedLocalMonth = dist.servedLocal.reduce((a, x) => a + x, 0);

    // 6) ÚNICO camino de pago: todas las obligaciones, prioridad por antigüedad
    for (const b of businesses) {
      const result = settleBooks(b.books, { obligations: b.obligations, month: m });
      treasuryBunz += result.treasuryBunzDelta;
      settledMonth += result.settled;

      // Invariante de prioridad: si se pagó algo, no puede quedar una
      // obligación pagable MÁS ANTIGUA sin pagar.
      const paidMaxDue = result.allocations.length
        ? Math.max(...result.allocations.map((a) => a.dueMonth))
        : -Infinity;
      const unpaidPayable = b.obligations.filter(
        (o) =>
          o.outstanding > 0 &&
          (o.state === OBLIGATION_STATE.OPEN ||
            o.state === OBLIGATION_STATE.RESOLVED_PAYABLE ||
            o.state === OBLIGATION_STATE.PARTIALLY_PAID)
      );
      const unpaidMinDue = unpaidPayable.length
        ? Math.min(...unpaidPayable.map((o) => o.dueMonth))
        : Infinity;
      if (paidMaxDue > unpaidMinDue) priorityViolations++;
      // 1 = se respetó la prioridad global; 0 = se pagó una nueva antes que una vieja
      check(`prioridad-global ${b.id}`, paidMaxDue <= unpaidMinDue ? 1 : 0, 1);
      check(
        `settled=allocations ${b.id}`,
        result.settled,
        result.allocations.reduce((a, x) => a + x.amount, 0)
      );
    }

    // 7) Tesorería: exceso → bonos + quema (recomposición de stock)
    const excess = Math.max(0, treasuryBunz - RESERVE);
    if (excess > 0) {
      const bonus = excess * BONUS_SHARE;
      const burn = excess * BURN_SHARE;
      treasuryBunz -= bonus;
      C += bonus;
      bonusMonth += bonus;
      const comp = bonus * 0.5;
      const per = comp / N;
      for (const b of businesses) b.sInitial += per;
      treasuryBunz -= comp;
      compMonth += comp;
      treasuryBunz -= burn;
      burnMonth += burn;
    }

    // 8) Métricas y concentración sobre la capacidad REAL
    const live = businesses.map((b) => b.sInitial + b.sPromo);
    const bcd = sum(live);
    const claims = C + Math.max(0, treasuryBunz);
    const ce = claims > 0 ? bcd / claims : Infinity;
    const conc = concentrationOf(live, businesses.map((b) => b.category));

    const overdueTotal = businesses.reduce(
      (a, b) => a + outstandingOf(b.obligations, { scope: "overdue", month: m }),
      0
    );
    const longOverdueTotal = businesses.reduce(
      (a, b) =>
        a + outstandingOf(b.obligations, { scope: "longOverdue", month: m, longOverdueMonths: cfg.longOverdueMonths }),
      0
    );
    const disputedTotal = businesses.reduce(
      (a, b) => a + outstandingOf(b.obligations, { scope: "disputed" }),
      0
    );
    const outstandingTotal = businesses.reduce(
      (a, b) => a + outstandingOf(b.obligations, { scope: "all", includeDisputed: true }),
      0
    );

    if (cfg.dynamicCaps) {
      // verificación FINAL por afiliado, categoría y mes
      const capsNow = capsViolationOf(live, businesses.map((b) => b.category));
      violationEndOfMonth = Math.max(0, capsNow.violation);
      categoryViolationEndOfMonth = Math.max(
        0,
        ...Object.values(conc.byCategory).map((s) => s - CAPS.category)
      );
      // recomputación INDEPENDIENTE (no reutiliza concentrationOf)
      const sortedLive = [...live].sort((a, b) => b - a);
      check("conc-final-top1", bcd > 0 ? sortedLive[0] / bcd : 0, conc.top1);
      check("conc-final-top3", bcd > 0 ? sum(sortedLive.slice(0, 3)) / bcd : 0, conc.top3);
      check("conc-final-hhi", bcd > 0 ? live.reduce((a, x) => a + Math.pow(x / bcd, 2), 0) : 0, conc.hhi);
      for (const [c, share] of Object.entries(conc.byCategory)) {
        // identidad: la participación registrada es la capacidad real de esa categoría
        const real = businesses.filter((b) => String(b.category) === String(c)).reduce((a, b) => a + b.sInitial + b.sPromo, 0);
        check(`conc-final-cat-${c}`, bcd > 0 ? real / bcd : 0, share);
      }
    }

    const activeServed = businesses.filter((b) => b.lastServedMonth === m).length;
    const activeEmitted = businesses.filter((b) => b.emitted > 0).length;

    // ── Reconciliación ──────────────────────────────────────────────────────
    check("C", start.C + rewardsNetMonth + bonusMonth - servedMonth, C);
    check(
      "T",
      start.T + rewardCommissionMonth + settledMonth - bonusMonth - compMonth - burnMonth,
      treasuryBunz
    );
    check("issuance", start.issuance + packageIssuanceMonth - rewardsMonth, sumB("issuance"));
    check("budget-reserved", start.reserved + contributionsMonth - settledMonth, sumBooks("reserved"));
    check("budget-released", start.released + settledMonth, sumBooks("released"));
    check("settled-in-bunz", start.settledInBunz + settledMonth, sumBooks("settledInBunz"));
    check("reserved+released", sumBooks("endowment") + sumBooks("contributions"), sumBooks("reserved") + sumBooks("released"));
    check("fiat-collected=0", 0, sumBooks("fiatCollected"));
    check("accrued", start.accrued + fiatAccruedMonth + redeemAccruedMonth, sumB("commissionAccrued"));
    check("writtenOff", start.writtenOff + writtenOffMonth, sumB("writtenOff"));
    check(
      "outstanding",
      sumB("commissionAccrued") - sumBooks("settledInBunz") - sumB("writtenOff"),
      outstandingTotal
    );
    check("endowment-origen", start.endowment, sumBooks("endowment"));
    check("sInitial", start.sInitial + packageStockMonth + compMonth - servedInitialMonth, sumB("sInitial"));
    check("sPromo", start.sPromo - servedPromoMonth, sumB("sPromo"));
    check("requested=served+unmet", servedMonthTotal + unmetEcosystemMonth, requestedMonth);
    check("served-local+reassigned", servedLocalMonth + reassignedMonth, servedMonthTotal);
    check("stock-consumido=servido", servedInitialMonth + servedPromoMonth, servedMonthTotal);
    // Invariantes de política: no hay fiat modelado y no se concede más de lo disponible
    check("treasury-fiat=0", 0, treasuryFiat);
    check("fiat-cobrado=0", 0, commissionFiatCollected);
    businesses.forEach((b, i) => {
      const split = packagesActive ? authForMonth.splits[i] : null;
      if (split) {
        // concedido nunca supera lo disponible de ESE afiliado
        check(`granted<=available ${b.id}`, Math.min(split.granted, split.available), split.granted);
      }
      check(`committed<=hard ${b.id}`, Math.min(b.authorizedCommitted, b.hardAuthorizationLimit), b.authorizedCommitted);
    });

    blockedStockTotal += blockedLimitMonth + blockedCapsMonth;
    blockedByCapsTotal += blockedCapsMonth;
    blockedByLimitTotal += blockedLimitMonth;

    history.push({
      month: m,
      C: Math.round(C),
      bcd: Math.round(bcd),
      ce: Number.isFinite(ce) ? Number(ce.toFixed(3)) : Infinity,
      T: Math.round(treasuryBunz),
      overdue: Math.round(overdueTotal),
      longOverdue: Math.round(longOverdueTotal),
      disputed: Math.round(disputedTotal),
      outstanding: Math.round(outstandingTotal),
      issuance: Math.round(sumB("issuance")),
      reserved: Math.round(sumBooks("reserved")),
      released: Math.round(sumBooks("released")),
      settledInBunz: Math.round(sumBooks("settledInBunz")),
      accrued: Math.round(sumB("commissionAccrued")),
      fiatCollected: 0,
      requested: Math.round(requestedMonth),
      served: Math.round(servedMonthTotal),
      unmetLocal: Math.round(unmetLocalMonth),
      unmetEcosystem: Math.round(unmetEcosystemMonth),
      reassigned: Math.round(reassignedMonth),
      blocked: Math.round(blockedLimitMonth + blockedCapsMonth),
      top1: Number(conc.top1.toFixed(3)),
      top3: Number(conc.top3.toFixed(3)),
      hhi: Number(conc.hhi.toFixed(3)),
      categoryMax: Number(Math.max(0, ...Object.values(conc.byCategory)).toFixed(3)),
      capViolation: Number(violationEndOfMonth.toFixed(4)),
      categoryViolation: Number(categoryViolationEndOfMonth.toFixed(4)),
      activeServed,
      activeEmitted,
      emitted: Math.round(rewardsMonth),
    });

    rewardsTotal += rewardsMonth;
  }

  const last = history[history.length - 1];

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
      longOverdue: last.longOverdue,
      disputed: last.disputed,
      outstanding: last.outstanding,
      issuance: last.issuance,
      reserved: last.reserved,
      released: last.released,
      settledInBunz: last.settledInBunz,
      accrued: last.accrued,
      writtenOff: Math.round(sumB("writtenOff")),
      fiatCollected: 0,
      requested: last.requested,
      served: last.served,
      unmetLocal: last.unmetLocal,
      unmetEcosystem: last.unmetEcosystem,
      reassigned: last.reassigned,
      blocked: Math.round(blockedStockTotal),
      blockedByCaps: Math.round(blockedByCapsTotal),
      blockedByLimit: Math.round(blockedByLimitTotal),
      top1: last.top1,
      top3: last.top3,
      hhi: last.hhi,
      categoryMax: last.categoryMax,
      activeServed: last.activeServed,
      activeEmitted: last.activeEmitted,
      emitted: Math.round(emitted),
      redeemed: Math.round(redeemed),
      recoveryMonths,
      capsInfeasibleMonths,
      capReasons: capReasonMonths,
      capBlockedEntities,
      priorityViolations,
      settlementMode: SETTLEMENT_MODE,
      merchantContribution: Math.round((fiatTotal - rewardsTotal - fiatCommTotal - redeemCommTotal) / N),
    },
  };
}

/** Mora: el afiliado no puede emitir ni renovar paquete (D_b). */
function overdueGate(b, m) {
  // Sólo obligaciones PAGABLES y vencidas. Una disputa congelada o un castigo
  // no pueden bloquear al afiliado indefinidamente.
  return b.obligations.some((o) => isPayable(o) && o.outstanding > 0 && isOverdue(o, m));
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
  {
    label: "Caps + categoría conc.",
    demand: concentrated(),
    capacity: concentrated(),
    dynamicCaps: true,
    category: categoryConcentrated(),
  },
  { label: "Sin paquetes", demand: uniform(), capacity: uniform(), noPackagesAfter: 0 },
  { label: "Pausa 3m (4-6)", demand: uniform(), capacity: uniform(), pauseFrom: 4, pauseTo: 6 },
  { label: "Presupuesto corto (pkg 0.25)", demand: uniform(), capacity: uniform(), packageScale: 0.25 },
  { label: "Disputa 20% (resolución 50%)", demand: uniform(), capacity: uniform(), disputedShare: 0.2 },
  {
    label: "Disputa 20% (nada pagable)",
    demand: uniform(),
    capacity: uniform(),
    disputedShare: 0.2,
    disputeFavorable: 0,
  },
  { label: "Estrés total", demand: concentrated(), capacity: concentrated(), noPackagesAfter: 2, rewardRate: 0.1, redemptionRate: 0.8 },
  { label: "Emisión cero", demand: uniform(), capacity: uniform(), rewardRate: 0 },
  { label: "Redención cero", demand: uniform(), capacity: uniform(), redemptionRate: 0 },
  { label: "Demanda x2", demand: uniform(), capacity: uniform(), fiatMultiplier: 2 },
  { label: "Recompensa 50%", demand: uniform(), capacity: uniform(), rewardRate: 0.5 },
  { label: "Recompensa 100%", demand: uniform(), capacity: uniform(), rewardRate: 1 },
];

const results = scen.map((s) => run(s));

const fmt = (x) => (x === null || x === undefined ? "-" : Math.round(x).toLocaleString("en-US"));

console.log(`\nBunz Economy v2.3.2.2 — ${MONTHS} meses, ${N} negocios`);
console.log(`Liquidación: ${SETTLEMENT_MODE} | fiat modelado: ${FIAT_SETTLEMENT_MODELED}\n`);
console.log(
  "Escenario".padEnd(36),
  "CE".padStart(7),
  "Circ".padStart(9),
  "Capac".padStart(10),
  "Deuda".padStart(9),
  "UnmetE".padStart(8),
  "UnmetL".padStart(8),
  "Top1".padStart(6),
  "Top3".padStart(6),
  "HHI".padStart(6),
  "CatMax".padStart(7),
  "Act".padStart(4)
);
console.log("-".repeat(120));
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(36),
    String(s.ce).padStart(7),
    fmt(s.C).padStart(9),
    fmt(s.bcd).padStart(10),
    fmt(s.overdue).padStart(9),
    fmt(s.unmetEcosystem).padStart(8),
    fmt(s.unmetLocal).padStart(8),
    String(s.top1).padStart(6),
    String(s.top3).padStart(6),
    String(s.hhi).padStart(6),
    String(s.categoryMax).padStart(7),
    String(s.activeServed).padStart(4)
  );
}

console.log("\nLibros separados (mes 12):");
console.log(
  "Escenario".padEnd(36),
  "Reservado".padStart(10),
  "Liberado".padStart(10),
  "LiqBunz".padStart(10),
  "Devengado".padStart(10),
  "FiatCobr".padStart(9),
  "TesBunz".padStart(9),
  "TesFiat".padStart(8)
);
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(36),
    fmt(s.reserved).padStart(10),
    fmt(s.released).padStart(10),
    fmt(s.settledInBunz).padStart(10),
    fmt(s.accrued).padStart(10),
    fmt(s.fiatCollected).padStart(9),
    fmt(s.T).padStart(9),
    fmt(0).padStart(8)
  );
}

const checks = results.reduce((a, r) => a + r.checks, 0);
const failures = results.flatMap((r) => r.failures.map((f) => ({ scenario: r.label, ...f })));
console.log(`\nReconciliación: ${checks} checks, ${failures.length} fallos.`);
if (failures.length) console.table(failures.slice(0, 15));
console.log(
  `Prioridad global de pago: ${results.reduce((a, r) => a + r.summary.priorityViolations, 0)} violaciones.`
);

// ── Sensibilidad 48 ────────────────────────────────────────────────────────
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
        reserved: r.summary.reserved,
        released: r.summary.released,
        settledInBunz: r.summary.settledInBunz,
        fiatCollected: r.summary.fiatCollected,
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

if (process.env.SIM_JSON) {
  console.log(
    "JSONRESULT:" +
      JSON.stringify({
        version: "2.3.2.2",
        months: MONTHS,
        businesses: N,
        checks,
        failures: failures.length,
        settlementMode: SETTLEMENT_MODE,
        fiatModeled: FIAT_SETTLEMENT_MODELED,
        scenarios: results.map((r) => r.summary),
        sensitivity: grid,
      })
  );
}

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
    "Reserv".padStart(9),
    "Liber".padStart(9),
    "Top3".padStart(6),
    "CatMax".padStart(7)
  );
  for (const h of r.history) {
    console.log(
      String(h.month).padStart(4),
      fmt(h.C).padStart(9),
      fmt(h.bcd).padStart(9),
      String(h.ce).padStart(6),
      fmt(h.overdue).padStart(8),
      fmt(h.unmetEcosystem).padStart(8),
      fmt(h.reassigned).padStart(8),
      fmt(h.reserved).padStart(9),
      fmt(h.released).padStart(9),
      String(h.top3).padStart(6),
      String(h.categoryMax).padStart(7)
    );
  }
}

detail("Sin paquetes");
detail("Caps dinámicos");
detail("Caps + categoría conc.");
detail("Presupuesto corto");
