#!/usr/bin/env node
/**
 * ── economy-sim v2.2 ───────────────────────────────────────────────────────
 * Simulación reproducible (determinista) de la economía Bunz.
 *
 * Auditoría v2.2:
 *  - Puente de conciliación mensual (stock inicial → recompensas → paquetes →
 *    compensación → redenciones → comisiones → stock final).
 *  - `treasuryOperatingReserveBunz` es un umbral de política de tesorería,
 *    NO un respaldo ni una reserva fiat.
 *  - Escenario de pausa de paquetes de 3 meses (meses 4–6).
 *  - Flujo entre afiliados y exposición de clearing como supuesto explícito.
 *  - `merchantContributionBeforeCogs` (no es utilidad).
 *
 * Uso:
 *   node scripts/economy-sim.mjs
 *   node scripts/economy-sim.mjs --months 24 --businesses 30 --crossShare 0.4
 */

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};

const MONTHS = arg("months", 12);
const BUSINESSES = arg("businesses", 20);
const FIAT_PER_BUSINESS = arg("fiat", 50000);
const GROWTH = arg("growth", 0.03);
const INITIAL_STOCK = arg("initialStock", 15000);
const MONTHLY_PACKAGE = arg("package", 5000);
const REWARD = arg("reward", 0.2);
const REDEMPTION = arg("redemption", 0.5);
const C_REWARD = 0.03;
const C_FIAT = 0.06;
const C_REDEEM = 0.02;
const BONUS = arg("bonus", 0);
const TREASURY_FLOOR = arg("floor", -50000);
/** Umbral de política: cuánto Bunz mantiene la tesorería antes de reciclar/quemar.
 *  NO es reserva fiat ni respaldo comercial. */
const TREASURY_OPERATING_RESERVE_BUNZ = arg("treasuryReserve", 100000);
const BONUS_SHARE = arg("bonusShare", 0.3);
const BURN_SHARE = arg("burnShare", 0.2);
/** Supuesto: % de redenciones que ocurren en un afiliado distinto al emisor. */
const CROSS_SHARE = arg("crossShare", 0.3);

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);

function trafficShares(concentration) {
  if (!concentration) return Array(BUSINESSES).fill(1 / BUSINESSES);
  const shares = Array(BUSINESSES).fill(0.2 / Math.max(1, BUSINESSES - 3));
  shares[0] = 0.3;
  shares[1] = 0.28;
  shares[2] = 0.22;
  return shares;
}

function run(scenario) {
  const {
    rewardRate = REWARD,
    redemptionRate = REDEMPTION,
    replenish = true,
    concentration = false,
    bonus = BONUS,
    unpaid = 0,
    pauseFrom = null,
    pauseTo = null,
    label,
  } = scenario;

  const shares = trafficShares(concentration);
  const businesses = shares.map((share, i) => ({
    id: i,
    share,
    stock: INITIAL_STOCK, // compromiso bruto
    debt: 0, // comisiones devengadas impagas
    rewards: 0,
    redeemed: 0,
    commissions: 0,
    fiat: 0,
  }));

  // disponible firmado = stock − debt (puede ser negativo)
  const avail = (b) => b.stock - b.debt;
  const totalAvail = () => businesses.reduce((a, b) => a + avail(b), 0);
  const positiveAvail = () =>
    businesses.reduce((a, b) => a + Math.max(0, avail(b)), 0);

  let circulation = 0;
  let treasury = 0;
  const history = [];
  let fiatTotal = 0;
  let rewardTotal = 0;
  let commissionTotal = 0;
  let redeemedTotal = 0;
  let clearingExposure = 0;
  let prevAvailable = INITIAL_STOCK * BUSINESSES;

  for (let m = 1; m <= MONTHS; m++) {
    const fiatMonth = FIAT_PER_BUSINESS * BUSINESSES * Math.pow(1 + GROWTH, m - 1);
    fiatTotal += fiatMonth;

    const bridge = {
      opening: prevAvailable,
      rewards: 0,
      packages: 0,
      compensation: 0,
      redemptions: 0,
      commissions: 0,
      closing: 0,
    };

    // 1) Venta fiat + recompensa (stock +R; usuario +R(1−3%); tesorería +3%R)
    for (const b of businesses) {
      const fiat = fiatMonth * b.share;
      b.fiat += fiat;
      const reward = fiat * rewardRate;
      b.rewards += reward;
      rewardTotal += reward;
      b.stock += reward;
      bridge.rewards += reward;
      circulation += reward * (1 - C_REWARD);
      treasury += reward * C_REWARD;
      commissionTotal += reward * C_REWARD;

      // Comisión fiat 6%: se cobra completa; solo la parte cubierta entra a
      // tesorería. El resto queda como deuda (D_b), sin crear capacidad.
      const fee = fiat * C_FIAT;
      b.commissions += fee;
      commissionTotal += fee;
      bridge.commissions += fee;

      // Si el afiliado no paga (escenario de impago), toda la comisión queda
      // como deuda y NO entra a tesorería. Su disponible baja igual: D_b.
      const skipped = unpaid > 0 && rng() < unpaid;
      if (skipped) {
        b.debt += fee;
      } else {
        const availableNow = avail(b);
        const paid = Math.min(Math.max(0, availableNow), fee);
        b.stock -= paid;
        const short = fee - paid;
        b.debt += short;
        treasury += paid;
      }
    }

    // 2b) Política de tesorería: reserva operativa, bonos y quema del excedente
    const excess = Math.max(0, treasury - TREASURY_OPERATING_RESERVE_BUNZ);
    if (excess > 0) {
      const toBonus = excess * BONUS_SHARE;
      const toBurn = excess * BURN_SHARE;
      if (toBonus > 0) {
        treasury -= toBonus;
        circulation += toBonus;
        const compensated = toBonus * 0.5;
        const perBiz = compensated / BUSINESSES;
        for (const biz of businesses) biz.stock += perBiz;
        bridge.compensation += compensated;
        treasury -= compensated;
      }
      if (toBurn > 0) treasury -= toBurn;
    }

    // 3) Redenciones (consumen disponible del afiliado donde se gasta)
    let target = Math.min(circulation, circulation * redemptionRate);
    let remaining = target;
    let redeemedMonth = 0;
    for (let pass = 0; pass < 2 && remaining > 0.01; pass++) {
      for (const b of businesses) {
        if (remaining <= 0.01) break;
        const available = Math.max(0, avail(b));
        if (available <= 0) continue;
        const want = Math.min(remaining * b.share * (pass === 0 ? 1 : 2), available);
        if (want <= 0) continue;
        b.stock -= want;
        b.redeemed += want;
        redeemedMonth += want;
        remaining -= want;
        circulation -= want;
        redeemedTotal += want;
        bridge.redemptions += want;
        const fee = want * C_REDEEM;
        const availableAfter = avail(b);
        const feePaid = Math.min(Math.max(0, availableAfter), fee);
        b.stock -= feePaid;
        b.debt += fee - feePaid;
        bridge.commissions += fee;
        treasury += feePaid;
        commissionTotal += fee;
      }
    }
    clearingExposure += redeemedMonth * CROSS_SHARE;

    // 4) Reposición (paquete mensual), con pausa opcional
    const paused = pauseFrom !== null && m >= pauseFrom && m <= pauseTo;
    if (replenish && !paused) {
      for (const b of businesses) b.stock += MONTHLY_PACKAGE;
      bridge.packages += MONTHLY_PACKAGE * BUSINESSES;
    }

    // 5) Bono adicional explícito (escenario)
    if (bonus > 0 && treasury >= TREASURY_FLOOR) {
      const b = Math.min(bonus, Math.max(0, treasury - TREASURY_FLOOR));
      treasury -= b;
      circulation += b;
      const compensated = b * 0.5;
      const perBiz = compensated / BUSINESSES;
      for (const biz of businesses) biz.stock += perBiz;
      bridge.compensation += compensated;
      treasury -= compensated;
    }

    // 6) Métricas y conciliación
    const closingAvailable = totalAvail();
    bridge.closing = closingAvailable;
    const explained =
      bridge.opening +
      bridge.rewards +
      bridge.packages +
      bridge.compensation -
      bridge.redemptions -
      bridge.commissions;
    const diff = Number((closingAvailable - explained).toFixed(2));

    const positive = positiveAvail();
    const claims = circulation + Math.max(0, treasury);
    const ce = claims > 0 ? positive / claims : Infinity;
    const unbacked = Math.max(0, claims - positive);
    const active = businesses.filter((b) => avail(b) > 1).length;

    history.push({
      month: m,
      circulation: Math.round(circulation),
      stock: Math.round(Math.max(0, closingAvailable)),
      treasury: Math.round(treasury),
      ce: Number(ce.toFixed(3)),
      unbacked: Math.round(unbacked),
      active,
      redeemed: Math.round(redeemedMonth),
      velocity: Number((redeemedMonth / Math.max(1, circulation)).toFixed(2)),
      bridge: Object.fromEntries(
        Object.entries(bridge).map(([k, v]) => [k, Math.round(v)])
      ),
      diff,
    });
    prevAvailable = closingAvailable;
  }

  const last = history[history.length - 1];
  const healthPerBiz =
    (fiatTotal - rewardTotal - commissionTotal) / BUSINESSES;
  return {
    label,
    history,
    summary: {
      label,
      ce12: last.ce,
      unbacked12: last.unbacked,
      circulation12: last.circulation,
      stock12: last.stock,
      treasury12: last.treasury,
      active12: last.active,
      velocity12: last.velocity,
      redeemedTotal: Math.round(redeemedTotal),
      rewardTotal: Math.round(rewardTotal),
      commissionTotal: Math.round(commissionTotal),
      clearingExposure: Math.round(clearingExposure),
      merchantContributionBeforeCogs: Math.round(healthPerBiz),
    },
  };
}

const scenarios = [
  { label: "Base (rew 20%, canje 50%)", rewardRate: 0.2, redemptionRate: 0.5 },
  { label: "Reward 10%", rewardRate: 0.1, redemptionRate: 0.5 },
  { label: "Reward 50%", rewardRate: 0.5, redemptionRate: 0.5 },
  { label: "Reward 100%", rewardRate: 1.0, redemptionRate: 0.5 },
  { label: "Canje 3x (150%)", rewardRate: 0.2, redemptionRate: 1.5 },
  { label: "Sin paquetes 12m", rewardRate: 0.2, redemptionRate: 0.5, replenish: false },
  { label: "Pausa 3m (4-6)", rewardRate: 0.2, redemptionRate: 0.5, pauseFrom: 4, pauseTo: 6 },
  { label: "Concentración 80/3", rewardRate: 0.2, redemptionRate: 0.5, concentration: true },
  { label: "Bono 10k/mes", rewardRate: 0.2, redemptionRate: 0.5, bonus: 10000 },
  { label: "Comisiones impagas 30%", rewardRate: 0.2, redemptionRate: 0.5, unpaid: 0.3 },
];

const results = scenarios.map(run);

console.log(`\nBunz Economy Sim v2.2 — ${MONTHS} meses, ${BUSINESSES} negocios, fiat ${FIAT_PER_BUSINESS}/mes`);
console.log(`Reserva operativa de tesorería: ${TREASURY_OPERATING_RESERVE_BUNZ} Bunz (umbral de política, NO respaldo)`);
console.log(`Supuesto de flujo cruzado: ${Math.round(CROSS_SHARE * 100)}% de redenciones en otro afiliado\n`);

console.log(
  "Escenario".padEnd(30),
  "CE".padStart(7),
  "UNBACKED".padStart(9),
  "Circ".padStart(10),
  "Stock".padStart(10),
  "Tesor".padStart(10),
  "Activos".padStart(8),
  "Vel".padStart(5),
  "Merchant*".padStart(10),
  "Clearing".padStart(10)
);
console.log("-".repeat(112));
for (const r of results) {
  const s = r.summary;
  console.log(
    s.label.padEnd(30),
    String(s.ce12).padStart(7),
    String(s.unbacked12).padStart(9),
    String(s.circulation12).padStart(10),
    String(s.stock12).padStart(10),
    String(s.treasury12).padStart(10),
    String(s.active12).padStart(8),
    String(s.velocity12).padStart(5),
    String(s.merchantContributionBeforeCogs).padStart(10),
    String(s.clearingExposure).padStart(10)
  );
}

function printBridge(title, result) {
  console.log(`\n${title}`);
  console.log(
    "Mes".padStart(4),
    "Inicial".padStart(9),
    "+Rew".padStart(9),
    "+Paq".padStart(9),
    "+Comp".padStart(9),
    "−Red".padStart(9),
    "−Com".padStart(9),
    "=Final".padStart(9),
    "Dif".padStart(6),
    "CE".padStart(6),
    "Act".padStart(4)
  );
  for (const h of result.history) {
    const b = h.bridge;
    console.log(
      String(h.month).padStart(4),
      String(b.opening).padStart(9),
      String(b.rewards).padStart(9),
      String(b.packages).padStart(9),
      String(b.compensation).padStart(9),
      String(b.redemptions).padStart(9),
      String(b.commissions).padStart(9),
      String(b.closing).padStart(9),
      String(h.diff).padStart(6),
      String(h.ce).padStart(6),
      String(h.active).padStart(4)
    );
  }
}

printBridge(
  "Puente de conciliación — Sin paquetes 12m",
  results.find((r) => r.label.includes("Sin paquetes"))
);
printBridge(
  "Puente de conciliación — Pausa 3 meses (4–6)",
  results.find((r) => r.label.includes("Pausa 3m"))
);

console.log("\n* Merchant = fiat − recompensas − comisiones. NO incluye COGS, mano de obra, renta ni impuestos.");
