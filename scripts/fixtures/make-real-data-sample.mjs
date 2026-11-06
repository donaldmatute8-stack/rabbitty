#!/usr/bin/env node
/**
 * Genera un dataset SINTÉTICO que cumple el contrato v1.0.
 * NO son datos reales: sirve para probar validadores y formatos.
 * Uso: node scripts/fixtures/make-real-data-sample.mjs
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const FIN = { from: "2025-10-01", to: "2026-03-31" };
const OP = { from: "2026-01-01", to: "2026-03-31" };

function lcg(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => iso(new Date(new Date(d).getTime() + n * 86400000));
const minDate = (a, b) => (String(a) < String(b) ? a : b);
const monthsBetween = (a, b) => {
  const out = [];
  const cur = new Date(a);
  const end = new Date(b);
  while (cur <= end) {
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
};

export function makeSample() {
  const rnd = lcg(20261106);
  const r2 = (x) => Math.round(x * 100) / 100;

  const categories = ["food", "coffee"];
  const sizes = ["S", "M"];
  const affiliates = [];
  let n = 0;
  for (const category of categories) {
    for (const size_band of sizes) {
      for (let k = 0; k < 5; k++) {
        n++;
        affiliates.push({
          id: `a${String(n).padStart(2, "0")}`,
          category,
          size_band,
          branch_id: `b${(n % 4) + 1}`,
          opened_at: "2024-01-15",
          status: "active",
        });
      }
    }
  }
  // inactivos (no entran en celdas de cobertura)
  for (let k = 1; k <= 4; k++) {
    n++;
    affiliates.push({
      id: `a${String(n).padStart(2, "0")}`,
      category: categories[k % 2],
      size_band: sizes[k % 2],
      branch_id: `b${(k % 4) + 1}`,
      opened_at: "2023-06-01",
      status: "inactive",
    });
  }
  const active = affiliates.filter((a) => a.status === "active");
  const months = monthsBetween(FIN.from, FIN.to);

  const sales = [];
  const rewards = [];
  const redemptions = [];
  const obligations = [];
  const fiatSettlements = [];
  const ledger = [];
  const capacity = [];
  const treasury = [];

  let saleId = 0;
  let rewardId = 0;
  for (const a of active) {
    for (const m of months) {
      saleId++;
      const base = a.size_band === "S" ? 40_000 : 90_000;
      const gross = r2(base * (0.85 + rnd() * 0.3));
      sales.push({
        id: `s${String(saleId).padStart(4, "0")}`,
        affiliate_id: a.id,
        ts: `${m}-15T12:00:00Z`,
        gross_mxn: gross,
        discount_bunz: r2(gross * 0.05),
        tickets: Math.max(1, Math.round(gross / 250)),
        user: `u${saleId % 37}`,
      });

      rewardId++;
      const bunz = r2(gross * 0.05);
      const reward = {
        id: `rw${String(rewardId).padStart(4, "0")}`,
        affiliate_id: a.id,
        user: `u${saleId % 37}`,
        ts: `${m}-15T12:05:00Z`,
        bunz,
        origin: "package",
        reward_id: `pkg-${m}`,
        expires_at: addDays(`${m}-15`, 90),
      };
      rewards.push(reward);
      ledger.push(
        { id: `l${ledger.length + 1}`, group: `em-${reward.id}`, ts: reward.ts, account: "emission_budget", direction: "debit", amount: bunz, ref_type: "reward", ref_id: reward.id },
        { id: `l${ledger.length + 2}`, group: `em-${reward.id}`, ts: reward.ts, account: "user_wallet", direction: "credit", amount: bunz, ref_type: "reward", ref_id: reward.id }
      );
    }
  }

  // Una recompensa revertida (para probar R23)
  const reversed = rewards[3];
  const reversal = {
    id: `rw${String(++rewardId).padStart(4, "0")}`,
    affiliate_id: reversed.affiliate_id,
    user: reversed.user,
    ts: "2026-01-20T09:00:00Z",
    bunz: reversed.bunz,
    origin: "package",
    reward_id: "pkg-reversal",
    expires_at: "2026-04-20",
    reversal_of: reversed.id,
  };
  rewards.push(reversal);
  ledger.push(
    { id: `l${ledger.length + 1}`, group: `rev-${reversal.id}`, ts: reversal.ts, account: "emission_budget", direction: "credit", amount: reversal.bunz, ref_type: "reversal", ref_id: reversal.id },
    { id: `l${ledger.length + 2}`, group: `rev-${reversal.id}`, ts: reversal.ts, account: "user_wallet", direction: "debit", amount: reversal.bunz, ref_type: "reversal", ref_id: reversal.id }
  );

  // Redenciones: 2 por afiliado activo, en la ventana operativa
  const usableRewards = rewards.filter((r) => !r.reversal_of && r.id !== reversed.id);
  const rewardsByAffiliate = new Map();
  for (const r of usableRewards) {
    if (!rewardsByAffiliate.has(r.affiliate_id)) rewardsByAffiliate.set(r.affiliate_id, []);
    rewardsByAffiliate.get(r.affiliate_id).push(r);
  }
  let redId = 0;
  active.forEach((a, idx) => {
    for (let k = 0; k < 2; k++) {
      redId++;
      const rw = rewardsByAffiliate.get(a.id)[k];
      const day = 10 + ((idx + k * 7) % 18);
      // Reparto en los tres meses operativos: un fixture para validación temporal
      // necesita actividad en la ventana de evaluación.
      const month = ["2026-01", "2026-02", "2026-03"][(idx + k) % 3];
      const requested_at = `${month}-${String(day).padStart(2, "0")}T18:00:00Z`;
      const bunz = Math.min(rw.bunz, 3000);
      const mode = (idx + k) % 10;
      const base = {
        id: `rd${String(redId).padStart(4, "0")}`,
        user: rw.user,
        requested_at,
        requested_affiliate: a.id,
        bunz,
        reward_id: rw.id,
      };
      if (mode === 7) {
        redemptions.push({ ...base, fulfilled_bunz: 0, status: "unfulfilled", reasons: ["capacity_exhausted"] });
      } else if (mode === 8) {
        redemptions.push({ ...base, fulfilled_bunz: 0, status: "cancelled", reasons: ["user_cancelled"] });
      } else if (mode === 9) {
        redemptions.push({ ...base, fulfilled_bunz: 0, status: "duplicate", reasons: ["duplicate"] });
      } else if (mode === 5) {
        redemptions.push({ ...base, fulfilled_bunz: 0, status: "unfulfilled", reasons: ["unknown"] });
      } else if (mode === 4) {
        const half = r2(bunz / 2);
        redemptions.push({
          ...base,
          fulfilled_at: `${month}-${String(day + 1).padStart(2, "0")}T10:00:00Z`,
          fulfilled_affiliate: a.id,
          fulfilled_bunz: half,
          status: "partial",
          reasons: ["out_of_stock"],
        });
      } else {
        // movilidad: algunas se redimen en otro afiliado
        const other = idx % 3 === 0 ? active[(idx + 5) % active.length].id : a.id;
        redemptions.push({
          ...base,
          fulfilled_at: `${month}-${String(day + 1).padStart(2, "0")}T10:00:00Z`,
          fulfilled_affiliate: other,
          fulfilled_bunz: bunz,
          status: "fulfilled",
          reasons: [],
        });
      }
    }
  });

  for (const r of redemptions) {
    if (!r.fulfilled_bunz) continue;
    ledger.push(
      { id: `l${ledger.length + 1}`, group: `rd-${r.id}`, ts: r.fulfilled_at, account: "user_wallet", direction: "debit", amount: r.fulfilled_bunz, ref_type: "redemption", ref_id: r.id },
      { id: `l${ledger.length + 2}`, group: `rd-${r.id}`, ts: r.fulfilled_at, account: "redemption_capacity", direction: "credit", amount: r.fulfilled_bunz, ref_type: "redemption", ref_id: r.id }
    );
  }

  // Obligaciones: 3 por afiliado (ene-mar), estados variados
  let obId = 0;
  active.forEach((a, idx) => {
    ["2026-01", "2026-02", "2026-03"].forEach((m, k) => {
      obId++;
      const gross = sales.filter((s) => s.affiliate_id === a.id && s.ts.startsWith(m)).reduce((x, s) => x + s.gross_mxn, 0);
      const bunz = r2(gross * 0.06);
      const mode = (idx + k) % 10;
      const accrued_at = `${m}-28`;
      const due_at = addDays(accrued_at, 15);
      const o = {
        id: `ob${String(obId).padStart(4, "0")}`,
        affiliate_id: a.id,
        origin: "fiat_sale",
        accrued_at,
        due_at,
        bunz,
        state: "OPEN",
        settled_bunz: 0,
        settled_fiat_mxn: 0,
      };
      if (mode <= 5) {
        o.state = "PAID";
        o.instrument = "bunz";
        o.settled_at = minDate(addDays(accrued_at, 5), FIN.to);
        o.settled_bunz = bunz;
      } else if (mode === 6) {
        o.state = "PAID";
        o.instrument = "fiat";
        o.settled_at = minDate(addDays(accrued_at, 7), FIN.to);
        o.settled_fiat_mxn = bunz;
        fiatSettlements.push({
          id: `fs${String(fiatSettlements.length + 1).padStart(4, "0")}`,
          obligation_id: o.id,
          received_at: o.settled_at,
          amount_mxn: bunz,
          bank_ref: `bank-${o.id}`,
          reconciled: true,
        });
      } else if (mode === 7) {
        o.state = "RESOLVED_NOT_PAYABLE";
        o.written_off_at = minDate(addDays(accrued_at, 20), FIN.to);
      } else {
        o.state = "OPEN";
      }
      obligations.push(o);
    });
  });

  // Fondeo del presupuesto + apertura de tesorería (contrapartida externa)
  ledger.push(
    { id: `l${ledger.length + 1}`, group: "fund-01", ts: "2025-10-01T00:00:00Z", account: "external", direction: "debit", amount: 500_000, ref_type: "funding", ref_id: "2025-10" },
    { id: `l${ledger.length + 2}`, group: "fund-01", ts: "2025-10-01T00:00:00Z", account: "commission_reserved", direction: "credit", amount: 500_000, ref_type: "funding", ref_id: "2025-10" },
    { id: `l${ledger.length + 3}`, group: "fund-02", ts: "2026-01-01T00:00:00Z", account: "external", direction: "debit", amount: 300_000, ref_type: "funding", ref_id: "2026-01" },
    { id: `l${ledger.length + 4}`, group: "fund-02", ts: "2026-01-01T00:00:00Z", account: "commission_reserved", direction: "credit", amount: 300_000, ref_type: "funding", ref_id: "2026-01" }
  );

  for (const o of obligations) {
    if (o.settled_bunz > 0) {
      ledger.push(
        { id: `l${ledger.length + 1}`, group: `st-${o.id}`, ts: o.settled_at, account: "commission_reserved", direction: "debit", amount: o.settled_bunz, ref_type: "obligation", ref_id: o.id },
        { id: `l${ledger.length + 2}`, group: `st-${o.id}`, ts: o.settled_at, account: "treasury_bunz", direction: "credit", amount: o.settled_bunz, ref_type: "obligation", ref_id: o.id }
      );
    }
    if (o.state === "RESOLVED_NOT_PAYABLE") {
      ledger.push(
        { id: `l${ledger.length + 1}`, group: `wo-${o.id}`, ts: o.written_off_at, account: "commission_reserved", direction: "debit", amount: o.bunz, ref_type: "obligation", ref_id: o.id },
        { id: `l${ledger.length + 2}`, group: `wo-${o.id}`, ts: o.written_off_at, account: "written_off", direction: "credit", amount: o.bunz, ref_type: "obligation", ref_id: o.id }
      );
    }
  }

  // Capacidad: snapshots semanales (13)
  const weekDates = [];
  for (let w = 0; w < 13; w++) weekDates.push(addDays(OP.from, w * 7));
  weekDates.push(OP.to);
  for (const a of active) {
    let consumed = 0;
    weekDates.forEach((d, w) => {
      const authorized = a.size_band === "S" ? 120_000 : 240_000;
      consumed = Math.min(authorized, consumed + (a.size_band === "S" ? 900 : 1800));
      capacity.push({ affiliate_id: a.id, date: d, authorized_bunz: authorized, consumed_bunz: consumed });
    });
  }

  // Tesorería: saldo del libro a cada fecha
  const sortedLedger = [...ledger].sort((x, y) => String(x.ts).localeCompare(String(y.ts)));
  const balanceAt = (date, account) => {
    let b = 0;
    for (const e of sortedLedger) {
      if (String(e.ts).slice(0, 10) > date) break;
      if (e.account !== account) continue;
      b += (e.direction === "credit" ? 1 : -1) * e.amount;
    }
    return b;
  };
  const fiatAt = (date) =>
    fiatSettlements.filter((f) => f.reconciled && f.bank_ref && f.received_at <= date).reduce((x, f) => x + f.amount_mxn, 0);

  for (const d of weekDates) {
    const bunz = balanceAt(d, "treasury_bunz");
    const fiat = fiatAt(d);
    treasury.push({ date: d, bunz_balance: r2(bunz), fiat_balance: r2(fiat), bank_balance: r2(fiat), reconciled: true });
  }

  const abuse_signals = [
    { id: "ab1", ts: "2026-02-03T10:00:00Z", user: "u7", type: "velocity", severity: "low", ref_id: "rd0007" },
    { id: "ab2", ts: "2026-03-11T16:00:00Z", user: "u21", type: "circular", severity: "medium", ref_id: null },
  ];

  return {
    spec_version: "1.0.0",
    dataset_kind: "synthetic-fixture",
    note: "Datos SINTÉTICOS para probar validadores. No son datos reales.",
    window: { operational: OP, financial: FIN },
    granularity: { capacity: "weekly", treasury: "weekly" },
    // Declaraciones obligatorias para calibrar (R24/R25).
    // `approved: true` aquí es un SUPUESTO DEL FIXTURE para poder ejecutar el
    // pipeline de extremo a extremo; NO representa una decisión de negocio.
    unit_policy: {
      bunz_per_mxn: 1,
      approved: true,
      note: "supuesto del fixture sintético; la paridad real sigue sin aprobar",
    },
    capacity_scope: "affiliate",
    affiliates,
    sales,
    rewards_issued: rewards,
    redemptions,
    capacity,
    obligations,
    fiat_settlements: fiatSettlements,
    bunz_ledger: ledger,
    treasury,
    abuse_signals,
  };
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("make-real-data-sample.mjs");
if (isDirectRun) {
  const out = fileURLToPath(new URL("./real-data-sample.json", import.meta.url));
  fs.writeFileSync(out, JSON.stringify(makeSample(), null, 2) + "\n");
  console.log(`fixture sintético escrito en ${out}`);
}
