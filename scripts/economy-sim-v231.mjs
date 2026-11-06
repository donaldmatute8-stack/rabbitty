#!/usr/bin/env node
/**
 * ── Bunz Economy v2.3.1 — Stress Test & Economic Validation ────────────────
 * SOLO SIMULACIÓN. No toca DB, producción, tasas, saldos, stock ni tesorería.
 *
 * Cambios frente a v2.3:
 *  - Demanda, capacidad, emisión y redención con distribuciones INDEPENDIENTES.
 *  - Redención por asignación proporcional + redistribución (independiente del orden).
 *  - Obligaciones individuales de comisión con vencimiento, disputa y pago parcial.
 *  - Paquetes calculados por perfil (MIRE), no constantes globales.
 *  - Libros separados: presupuesto, devengado, cobrado, tesorería.
 *  - Métricas de solicitudes no atendidas, actividad y concentración.
 *  - Escenarios de sensibilidad y estrés.
 */

const N = 20;
const MONTHS = 12;
const TOTAL_FIAT = 1_000_000; // MXN/mes del ecosistema
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
  disputedShare: 0,
  disputeMonths: 2,
  crossShare: 0.3,
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uniform() { return Array(N).fill(1 / N); }
function concentrated() {
  const s = Array(N).fill(0.2 / (N - 3));
  s[0] = 0.3; s[1] = 0.28; s[2] = 0.22;
  return s;
}
function cappedConcentrated() {
  const s = Array(N).fill(0.4 / (N - 3));
  s[0] = 0.25; s[1] = 0.2; s[2] = 0.15;
  return s;
}
function concentratedTail() {
  const s = Array(N).fill(0.2 / (N - 3));
  s[N - 1] = 0.3; s[N - 2] = 0.28; s[N - 3] = 0.22;
  return s;
}

/**
 * Corre un escenario.
 * demand: distribución de ventas fiat.
 * capacity: distribución de paquetes (capacidad/emisión/comisión).
 * redemption: distribución de la demanda de redención (independiente).
 */
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

  const businesses = Array.from({ length: N }, (_, i) => {
    return {
      id: i,
      demand: demand[i],
      capacity: capacity[i],
      redemption: redemption[i],
      sInitial: totalStock0 * capacity[i] * 0.5, // 0.5 mes inicial
      sPromo: 0,
      issuance: totalIssuance0 * capacity[i] * 0.5,
      commissionBudget: totalCommission0 * capacity[i] * 0.5,
      maxAuthorizable: totalStock0 * capacity[i] * 3,
      obligations: [],
      commissionAccrued: 0,
      commissionCollected: 0,
      emitted: 0,
      served: 0,
    };
  });

  let C = 0;
  let T = 0;
  let emitted = 0;
  let redeemed = 0;
  let requestedRedemption = 0;
  let servedRedemption = 0;
  let fiatTotal = 0;
  let rewardsTotal = 0;
  let fiatCommTotal = 0;
  let redeemCommTotal = 0;
  let checks = 0;
  const failures = [];
  const history = [];

  const sum = (key) => businesses.reduce((a, b) => a + b[key], 0);
  const check = (name, expected, actual) => {
    checks++;
    if (Math.abs(expected - actual) > 0.02) {
      failures.push({ name, expected, actual, diff: expected - actual });
    }
  };

  const outstandingOf = (b, month, { onlyOverdue = false, onlyLongOverdue = false, includeDisputed = false } = {}) => {
    return b.obligations.reduce((acc, o) => {
      if (o.outstanding <= 0) return acc;
      if (o.disputed && !includeDisputed) return acc;
      if (onlyOverdue && o.dueMonth > month) return acc;
      if (onlyLongOverdue && o.dueMonth > month - 1) return acc;
      return acc + o.outstanding;
    }, 0);
  };

  const payObligations = (b, amount, month) => {
    let remaining = Math.max(0, amount);
    const ordered = [...b.obligations].sort((x, y) => x.dueMonth - y.dueMonth || x.createdAt - y.createdAt);
    for (const o of ordered) {
      if (remaining <= 0) break;
      if (o.outstanding <= 0) continue;
      if (o.disputed && o.resolvedAt && o.resolvedAt > month) continue;
      const pay = Math.min(o.outstanding, remaining);
      o.outstanding -= pay;
      remaining -= pay;
      b.commissionCollected += pay;
      T += pay;
    }
    return amount - remaining;
  };

  const createObligation = (b, amount, month, kind) => {
    if (amount <= 0) return null;
    const disputed = cfg.disputedShare > 0 && rng() < cfg.disputedShare;
    const o = {
      id: `${b.id}-${month}-${kind}-${b.obligations.length}`,
      amount,
      outstanding: amount,
      dueMonth: month + 1,
      createdAt: month,
      kind,
      disputed,
      resolvedAt: disputed ? month + cfg.disputeMonths : undefined,
    };
    b.obligations.push(o);
    b.commissionAccrued += amount;
    return o;
  };

  for (let m = 1; m <= MONTHS; m++) {
    const start = {
      C, T,
      issuance: sum("issuance"),
      commissionBudget: sum("commissionBudget"),
      accrued: sum("commissionAccrued"),
      collected: sum("commissionCollected"),
      sInitial: sum("sInitial"),
      sPromo: sum("sPromo"),
    };

    const fiatMonth = TOTAL_FIAT * (cfg.fiatMultiplier ?? 1) * Math.pow(1 + GROWTH, m - 1);
    fiatTotal += fiatMonth;
    let rewardsMonth = 0;
    let rewardsNetMonth = 0;
    let rewardCommissionMonth = 0;
    let servedMonth = 0;
    let requestedMonth = 0;
    let servedInitialMonth = 0;
    let servedPromoMonth = 0;
    let fiatPaidMonth = 0;
    let fiatAccruedMonth = 0;
    let redeemPaidMonth = 0;
    let redeemAccruedMonth = 0;
    let packageStockMonth = 0;
    let packageIssuanceMonth = 0;
    let packageCommissionMonth = 0;
    let packagePaidMonth = 0;
    let bonusMonth = 0;
    let compMonth = 0;
    let burnMonth = 0;

    // 1) Reposición por MIRE (paquete individual, no global)
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

      for (const b of businesses) {
        const stock = totalStockMonth * b.capacity;
        const issuance = totalIssuanceMonth * b.capacity;
        const commission = totalCommissionMonth * b.capacity;

        const longOverdue = outstandingOf(b, m, { onlyLongOverdue: true });
        const authorizedCap = Math.max(0, b.maxAuthorizable - longOverdue);
        const stockAllowed = Math.min(stock, authorizedCap);

        const overdue = outstandingOf(b, m, { onlyOverdue: true });
        const stockFinal = overdue > 0 ? 0 : stockAllowed;
        const issuanceFinal = overdue > 0 ? 0 : issuance;

        b.sInitial += stockFinal;
        b.issuance += issuanceFinal;
        packageStockMonth += stockFinal;
        packageIssuanceMonth += issuanceFinal;

        // La comisión del paquete paga deuda primero; el resto va al presupuesto
        const paid = payObligations(b, Math.min(commission, b.commissionBudget + commission), m);
        packagePaidMonth += paid;
        const net = Math.max(0, commission - paid);
        b.commissionBudget += net;
        packageCommissionMonth += net;
      }
    }

    // 2) Recompensas: dos autorizaciones + bloqueo por deuda vencida
    for (const b of businesses) {
      const fiatB = fiatMonth * b.demand;
      const requested = fiatB * cfg.rewardRate;
      const overdue = outstandingOf(b, m, { onlyOverdue: true });
      const capacity = b.sInitial + b.sPromo;
      let granted = Math.min(requested, b.issuance, capacity);
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

    // 3) Comisiones fiat: obligación individual (vencimiento a 30 días)
    for (const b of businesses) {
      const fiatB = fiatMonth * b.demand;
      const fee = fiatB * C_FIAT;
      fiatCommTotal += fee;
      fiatAccruedMonth += fee;
      createObligation(b, fee, m, "FIAT");
      const paid = payObligations(b, Math.min(fee, b.commissionBudget), m);
      b.commissionBudget -= paid;
      fiatPaidMonth += paid;
    }

    // 4) Redenciones: demanda → asignación proporcional → capacidad → redistribución
    const target = Math.min(C, C * cfg.redemptionRate);
    const req = businesses.map((b) => target * b.redemption);
    const avail = businesses.map((b) => b.sInitial + b.sPromo);
    const served = req.map((r, i) => Math.min(r, avail[i]));
    let unmet = req.map((r, i) => r - served[i]);
    let spare = businesses.map((b, i) => Math.max(0, avail[i] - served[i]));

    for (let round = 0; round < 4; round++) {
      const totalUnmet = unmet.reduce((a, x) => a + x, 0);
      const totalSpare = spare.reduce((a, x) => a + x, 0);
      if (totalUnmet <= 0.01 || totalSpare <= 0.01) break;
      const extra = unmet.map((u, i) => (u <= 0 ? 0 : Math.min(u, totalUnmet * (spare[i] / totalSpare), spare[i])));
      for (let i = 0; i < N; i++) {
        served[i] += extra[i];
        unmet[i] -= extra[i];
        spare[i] -= extra[i];
      }
    }

    businesses.forEach((b, i) => {
      const take = served[i];
      if (take <= 0) return;
      b.served += take;
      const fromInitial = Math.min(b.sInitial, take);
      const fromPromo = take - fromInitial;
      b.sInitial -= fromInitial;
      b.sPromo -= fromPromo;
      servedInitialMonth += fromInitial;
      servedPromoMonth += fromPromo;
      servedMonth += take;
      C -= take;
      const fee = take * C_REDEEM;
      redeemCommTotal += fee;
      redeemAccruedMonth += fee;
      createObligation(b, fee, m, "REDEEM");
      const paid = payObligations(b, Math.min(fee, b.commissionBudget), m);
      b.commissionBudget -= paid;
      redeemPaidMonth += paid;
    });

    requestedMonth = req.reduce((a, x) => a + x, 0);
    requestedRedemption += requestedMonth;
    servedRedemption += servedMonth;
    redeemed += servedMonth;

    // 5) Política de tesorería (solo sobre cobrado)
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

    // 6) Métricas
    const bcdByBiz = businesses.map((b) => Math.max(0, b.sInitial + b.sPromo));
    const bcd = bcdByBiz.reduce((a, x) => a + x, 0);
    const claims = C + Math.max(0, T);
    const ce = claims > 0 ? bcd / claims : Infinity;
    const overdue = businesses.reduce((a, b) => a + outstandingOf(b, m, { onlyOverdue: true }), 0);
    const disputed = businesses.reduce((a, b) => a + outstandingOf(b, m, { includeDisputed: true }) - outstandingOf(b, m), 0);
    const outstanding = businesses.reduce(
      (a, b) => a + b.obligations.reduce((x, o) => x + o.outstanding, 0),
      0
    );
    const sorted = [...bcdByBiz].sort((a, b) => b - a);
    const top3 = bcd > 0 ? sorted.slice(0, 3).reduce((a, x) => a + x, 0) / bcd : 0;
    const hhi = bcd > 0 ? bcdByBiz.reduce((a, x) => a + Math.pow(x / bcd, 2), 0) : 0;
    const active = bcdByBiz.filter((x) => x > 1).length;
    const activeServed = businesses.filter((b) => b.served > 0).length;
    const activeEmitted = businesses.filter((b) => b.emitted > 0).length;

    // 7) Reconciliación
    check("C", start.C + rewardsNetMonth + bonusMonth - servedMonth, C);
    check("T", start.T + rewardCommissionMonth + fiatPaidMonth + redeemPaidMonth + packagePaidMonth - bonusMonth - compMonth - burnMonth, T);
    check("issuance", start.issuance + packageIssuanceMonth - rewardsMonth, sum("issuance"));
    check("commissionBudget", start.commissionBudget + packageCommissionMonth - fiatPaidMonth - redeemPaidMonth, sum("commissionBudget"));
    check("commissionAccrued", start.accrued + fiatAccruedMonth + redeemAccruedMonth, sum("commissionAccrued"));
    check("commissionCollected", start.collected + fiatPaidMonth + redeemPaidMonth + packagePaidMonth, sum("commissionCollected"));
    check("sInitial", start.sInitial + packageStockMonth + compMonth - servedInitialMonth, sum("sInitial"));
    check("sPromo", start.sPromo - servedPromoMonth, sum("sPromo"));
    check("outstanding", sum("commissionAccrued") - sum("commissionCollected"), outstanding);

    history.push({
      month: m,
      C: Math.round(C),
      bcd: Math.round(bcd),
      ce: Number(ce.toFixed(3)),
      T: Math.round(T),
      overdue: Math.round(overdue),
      disputed: Math.round(disputed),
      issuance: Math.round(sum("issuance")),
      commissionBudget: Math.round(sum("commissionBudget")),
      accrued: Math.round(sum("commissionAccrued")),
      collected: Math.round(sum("commissionCollected")),
      requested: Math.round(requestedMonth),
      served: Math.round(servedMonth),
      unmetRate: requestedMonth > 0 ? Number(((requestedMonth - servedMonth) / requestedMonth).toFixed(3)) : 0,
      top3: Number(top3.toFixed(3)),
      hhi: Number(hhi.toFixed(3)),
      active,
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
      disputed: last.disputed,
      issuance: last.issuance,
      commissionBudget: last.commissionBudget,
      accrued: last.accrued,
      collected: last.collected,
      unmetRate: last.unmetRate,
      top3: last.top3,
      hhi: last.hhi,
      active: last.active,
      activeServed: last.activeServed,
      activeEmitted: last.activeEmitted,
      disputed: last.disputed,
      emitted: Math.round(emitted),
      redeemed: Math.round(redeemed),
      requested: Math.round(requestedRedemption),
      served: Math.round(servedRedemption),
      merchantContribution: Math.round(
        (fiatTotal - rewardsTotal - fiatCommTotal - redeemCommTotal) / N
      ),
    },
  };
}

// ── Escenarios ──────────────────────────────────────────────────────────────
const base = { label: "Base alineado", demand: uniform(), capacity: uniform() };
const scen = [
  base,
  { label: "Demanda conc. / capacidad dist.", demand: concentrated(), capacity: uniform() },
  { label: "Demanda conc. / capacidad conc.", demand: concentrated(), capacity: concentrated() },
  { label: "Demanda dist. / capacidad conc.", demand: uniform(), capacity: concentrated() },
  { label: "Desalineado (demanda vs capacidad)", demand: concentrated(), capacity: concentratedTail() },
  { label: "Capacidad capeada (top1 25%)", demand: concentrated(), capacity: cappedConcentrated() },
  { label: "Sin paquetes", demand: uniform(), capacity: uniform(), noPackagesAfter: 0 },
  { label: "Pausa 3m (4-6)", demand: uniform(), capacity: uniform(), pauseFrom: 4, pauseTo: 6 },
  { label: "Disputa 20%", demand: uniform(), capacity: uniform(), disputedShare: 0.2 },
  { label: "Estrés total", demand: concentrated(), capacity: concentrated(), noPackagesAfter: 2, rewardRate: 0.1, redemptionRate: 0.8 },
  { label: "Emisión cero", demand: uniform(), capacity: uniform(), rewardRate: 0 },
  { label: "Redención cero", demand: uniform(), capacity: uniform(), redemptionRate: 0 },
  { label: "Demanda x2", demand: uniform(), capacity: uniform(), fiatMultiplier: 2 },
];

const results = scen.map((s) => run(s));

console.log(`\nBunz Economy v2.3.1 — ${MONTHS} meses, ${N} negocios\n`);
console.log(
  "Escenario".padEnd(38),
  "CE".padStart(7),
  "Circ".padStart(9),
  "Capac".padStart(10),
  "Deuda".padStart(9),
  "Emisión".padStart(9),
  "ComB".padStart(9),
  "Unmet".padStart(7),
  "Top3".padStart(6),
  "HHI".padStart(6),
  "ActS".padStart(5),
  "ActE".padStart(5)
);
console.log("-".repeat(125));
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(38),
    String(s.ce).padStart(7),
    String(s.C).padStart(9),
    String(s.bcd).padStart(10),
    String(s.overdue).padStart(9),
    String(s.issuance).padStart(9),
    String(s.commissionBudget).padStart(9),
    String(s.unmetRate).padStart(7),
    String(s.top3).padStart(6),
    String(s.hhi).padStart(6),
    String(s.activeServed).padStart(5),
    String(s.activeEmitted).padStart(5)
  );
}

console.log("\nLibros de comisión (mes 12):");
console.log(
  "Escenario".padEnd(38),
  "Devengado".padStart(11),
  "Cobrado".padStart(10),
  "Presupuesto".padStart(12),
  "Vencido".padStart(10),
  "Disputa".padStart(10),
  "Tesorería".padStart(10)
);
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(38),
    String(s.accrued).padStart(11),
    String(s.collected).padStart(10),
    String(s.commissionBudget).padStart(12),
    String(s.overdue).padStart(10),
    String(s.disputed).padStart(10),
    String(s.T).padStart(10)
  );
}

const checks = results.reduce((a, r) => a + r.checks, 0);
const failures = results.flatMap((r) => r.failures.map((f) => ({ scenario: r.label, ...f })));
console.log(`\nReconciliación: ${checks} checks, ${failures.length} fallos.`);
if (failures.length) console.table(failures.slice(0, 15));

// ── Sensibilidad: reward × redemption × packageScale ──────────────────────
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
        unmet: r.summary.unmetRate,
        overdue: r.summary.overdue,
        active: r.summary.active,
        emitted: r.summary.emitted,
        served: r.summary.served,
        requested: r.summary.requested,
        unmetAmount: Math.max(0, r.summary.requested - r.summary.served),
        issuance: r.summary.issuance,
        C: r.summary.C,
        bcd: r.summary.bcd,
      });
    }
  }
}
if (process.env.SIM_JSON) {
  console.log(
    "JSONRESULT:" +
      JSON.stringify({
        months: MONTHS,
        businesses: N,
        scenarios: results.map((r) => r.summary),
        sensitivity: grid,
      })
  );
}

console.log("\nSensibilidad (mejor/peor por unmetRate y deuda):");
const activeGrid = grid.filter((g) => Number.isFinite(g.ce) && g.active > 0);
const sortedUnmet = [...activeGrid].sort((a, b) => a.unmet - b.unmet);
console.log("Mejor unmet (con actividad):", sortedUnmet[0]);
console.log("Peor unmet (con actividad):", sortedUnmet[sortedUnmet.length - 1]);
const sortedDebt = [...grid].sort((a, b) => b.overdue - a.overdue);
console.log("Mayor deuda:", sortedDebt[0]);
console.log("Menor deuda:", sortedDebt[sortedDebt.length - 1]);

function detail(name) {
  const r = results.find((x) => x.label.includes(name));
  console.log(`\nDetalle: ${r.label}`);
  console.log(
    "Mes".padStart(4),
    "Circ".padStart(9),
    "Capac".padStart(9),
    "CE".padStart(6),
    "Deuda".padStart(8),
    "Emit".padStart(8),
    "Unmet".padStart(7),
    "Top3".padStart(6),
    "Act".padStart(4)
  );
  for (const h of r.history) {
    console.log(
      String(h.month).padStart(4),
      String(h.C).padStart(9),
      String(h.bcd).padStart(9),
      String(h.ce).padStart(6),
      String(h.overdue).padStart(8),
      String(h.emitted).padStart(8),
      String(h.unmetRate).padStart(7),
      String(h.top3).padStart(6),
      String(h.active).padStart(4)
    );
  }
}
detail("Sin paquetes");
detail("Estrés total");
detail("Desalineado");
