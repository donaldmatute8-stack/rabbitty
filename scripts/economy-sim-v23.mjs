#!/usr/bin/env node
/**
 * ── economy-sim v2.3 ───────────────────────────────────────────────────────
 * Modelo de CUATRO CUBOS (RP económico v2.2/v2.3):
 *   S_redeem_initial  capacidad de redención del paquete
 *   S_redeem_promo    capacidad promocional adicional
 *   B_issuance_budget tope de recompensas emitibles (NO crea capacidad)
 *   B_commission_budget Bunz para comisiones (NO es capacidad de redención)
 *
 * Regla clave: emitir una recompensa exige DOS autorizaciones:
 *   1) presupuesto de emisión, 2) capacidad de redención comprometida.
 * La emisión NO incrementa la capacidad por sí sola.
 *
 * Determinista. Solo simulación: no toca DB ni código de producción.
 */

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};

const MONTHS = arg("months", 12);
const BUSINESSES = arg("businesses", 20);
const FIAT = arg("fiat", 50000);
const GROWTH = arg("growth", 0.03);
const REWARD = arg("reward", 0.2);
const REDEMPTION = arg("redemption", 0.5);
const C_REWARD = 0.03;
const C_FIAT = 0.06;
const C_REDEEM = 0.02;
const CROSS = arg("cross", 0.3);

const INITIAL = { stock: 30000, issuance: 20000, commission: 10000 };
const PACKAGE = { stock: 15000, issuance: 10000, commission: 5000 };

const RESERVE = arg("reserve", 100000);
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
    rewardRate = REWARD,
    redemptionRate = REDEMPTION,
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
  const history = [];

  for (let m = 1; m <= MONTHS; m++) {
    const fiatMonth = FIAT * BUSINESSES * Math.pow(1 + GROWTH, m - 1);
    fiatTotal += fiatMonth;
    let rewardsMonth = 0;
    let requestedMonth = 0;
    let redeemedMonth = 0;
    let fiatCommMonth = 0;
    let redeemCommMonth = 0;
    let compensationMonth = 0;

    // 1) Fiat + recompensas (dos autorizaciones; NO crean capacidad)
    for (const b of businesses) {
      const fiat = fiatMonth * b.share;
      b.fiat += fiat;
      const requested = fiat * rewardRate;
      const capacity = b.sInitial + b.sPromo;
      let granted = Math.min(requested, b.issuance, capacity);
      if (b.debt > 0) granted = 0; // deuda bloquea nuevas emisiones
      b.issuance -= granted;
      b.rewards += granted;
      b.requestedRewards += requested;
      requestedMonth += requested;
      rewardsMonth += granted;
      C += granted * (1 - C_REWARD);
      T += granted * C_REWARD;

      const fee = fiat * C_FIAT;
      b.commissions += fee;
      fiatCommMonth += fee;
      const skipped = unpaid > 0 && rng() < unpaid;
      const paid = skipped ? 0 : Math.min(fee, b.commission);
      b.commission -= paid;
      b.debt += fee - paid;
      T += paid;
    }

    // 2) Política de tesorería: reserva, bonos y quema (cuentas separadas)
    const excess = Math.max(0, T - RESERVE);
    if (excess > 0) {
      const bonus = excess * BONUS_SHARE;
      const burn = excess * BURN_SHARE;
      T -= bonus;
      C += bonus;
      const comp = bonus * 0.5;
      const perBiz = comp / BUSINESSES;
      for (const b of businesses) b.sInitial += perBiz;
      T -= comp;
      compensationMonth += comp;
      T -= burn;
    }

    // 3) Redenciones (consumen capacidad; comisión al presupuesto, no a la capacidad)
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
        b.sInitial -= fromInitial;
        b.sPromo -= Math.max(0, want - fromInitial);
        b.redeemed += want;
        redeemedMonth += want;
        remaining -= want;
        C -= want;
        const fee = want * C_REDEEM;
        redeemCommMonth += fee;
        const paid = Math.min(fee, b.commission);
        b.commission -= paid;
        b.debt += fee - paid;
        T += paid;
      }
    }
    redeemedTotal += redeemedMonth;
    clearingExposure += redeemedMonth * CROSS;

    // 4) Paquete mensual (reposición), con pausa opcional
    const paused = pauseFrom !== null && m >= pauseFrom && m <= pauseTo;
    if (replenish && !paused) {
      for (const b of businesses) {
        b.sInitial += PACKAGE.stock;
        // El presupuesto de comisión primero paga deuda
        const allocation = PACKAGE.commission;
        const payDebt = Math.min(b.debt, allocation);
        b.debt -= payDebt;
        b.commission += allocation - payDebt;
        b.issuance += PACKAGE.issuance * issuanceScale;
      }
    }

    const bcd = businesses.reduce((a, b) => a + Math.max(0, b.sInitial + b.sPromo), 0);
    const debtTotal = businesses.reduce((a, b) => a + b.debt, 0);
    const claims = C + Math.max(0, T);
    const ce = claims > 0 ? bcd / claims : Infinity;
    const unbacked = Math.max(0, claims - bcd);
    const active = businesses.filter((b) => b.sInitial + b.sPromo > 1).length;

    history.push({
      month: m,
      circulation: Math.round(C),
      capacity: Math.round(bcd),
      treasury: Math.round(T),
      debt: Math.round(debtTotal),
      ce: Number(ce.toFixed(3)),
      unbacked: Math.round(unbacked),
      active,
      rewards: Math.round(rewardsMonth),
      requested: Math.round(requestedMonth),
      redeemed: Math.round(redeemedMonth),
      compensation: Math.round(compensationMonth),
      velocity: Number((redeemedMonth / Math.max(1, C)).toFixed(2)),
    });

    rewardsTotal += rewardsMonth;
    requestedTotal += requestedMonth;
    fiatCommTotal += fiatCommMonth;
    redeemCommTotal += redeemCommMonth;
  }

  const last = history[history.length - 1];
  return {
    label,
    history,
    summary: {
      label,
      ce: last.ce,
      unbacked: last.unbacked,
      circulation: last.circulation,
      capacity: last.capacity,
      treasury: last.treasury,
      debt: last.debt,
      active: last.active,
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

console.log(`\nBunz Economy Sim v2.3 — ${MONTHS} meses, ${BUSINESSES} negocios`);
console.log("Modelo de 4 cubos: la emisión NO crea capacidad; requiere presupuesto + capacidad.\n");
console.log(
  "Escenario".padEnd(30),
  "CE".padStart(7),
  "UNBACKED".padStart(9),
  "Circ".padStart(10),
  "Capac".padStart(10),
  "Tesor".padStart(9),
  "Deuda".padStart(9),
  "Act".padStart(4),
  "Rewards".padStart(9),
  "Merchant*".padStart(10)
);
console.log("-".repeat(112));
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(30),
    String(s.ce).padStart(7),
    String(s.unbacked).padStart(9),
    String(s.circulation).padStart(10),
    String(s.capacity).padStart(10),
    String(s.treasury).padStart(9),
    String(s.debt).padStart(9),
    String(s.active).padStart(4),
    String(s.rewards).padStart(9),
    String(s.merchantContribution).padStart(10)
  );
}

function detail(name) {
  const r = results.find((x) => x.label.includes(name));
  console.log(`\nDetalle: ${r.label}`);
  console.log(
    "Mes".padStart(4),
    "Circ".padStart(9),
    "Capac".padStart(9),
    "CE".padStart(7),
    "UNBACKED".padStart(9),
    "Deuda".padStart(8),
    "Act".padStart(4),
    "Rewards".padStart(9),
    "Solicitado".padStart(10)
  );
  for (const h of r.history) {
    console.log(
      String(h.month).padStart(4),
      String(h.circulation).padStart(9),
      String(h.capacity).padStart(9),
      String(h.ce).padStart(7),
      String(h.unbacked).padStart(9),
      String(h.debt).padStart(8),
      String(h.active).padStart(4),
      String(h.rewards).padStart(9),
      String(h.requested).padStart(10)
    );
  }
}

detail("Sin paquetes");
detail("Pausa 3m");

console.log("\n* Merchant = fiat − recompensas brutas − comisión fiat − comisión de redención.");
console.log("  NO incluye COGS, mano de obra, renta ni impuestos. No es utilidad.");
