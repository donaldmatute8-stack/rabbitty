#!/usr/bin/env node
/**
 * Fixture de PILOTO: 1 afiliado, 2 usuarios, 3 semanas.
 * Contiene SOLO lo que el SQL read-only puede producir hoy.
 * Los datasets ausentes se declaran como huecos, no se rellenan.
 *
 * NO son datos reales: es un fixture que reproduce la forma de un export piloto.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => iso(new Date(new Date(d).getTime() + n * 86400000));

export function makePilotSample() {
  const start = "2026-03-02";
  const users = ["u1", "u2"];
  const sales = [];
  const rewards = [];
  const redemptions = [];
  const treasury = [];
  const fiat = [];

  let n = 0;
  let balance = 0;
  for (let d = 0; d < 21; d++) {
    const date = addDays(start, d);
    for (const user of users) {
      n++;
      const gross = 220 + ((d * 37 + n * 13) % 380);
      const bunz = Math.round(gross * 0.05);
      const id = `s${String(n).padStart(4, "0")}`;

      sales.push({
        id,
        affiliate_id: "a01",
        ts: `${date}T${13 + (n % 6)}:15:00Z`,
        gross_mxn: gross,
        discount_bunz: 0,
        tickets: 1,
        user,
      });
      rewards.push({
        id: `rw${String(n).padStart(4, "0")}`,
        affiliate_id: "a01",
        user,
        ts: `${date}T${13 + (n % 6)}:16:00Z`,
        bunz,
        origin: "package",
        reward_id: id,
        expires_at: addDays(date, 90),
      });
      balance += bunz;
    }
    treasury.push({
      date,
      bunz_balance: balance,
      fiat_balance: null,
      bank_balance: null,
      reconciled: false,
    });
  }

  // 6 redenciones cumplidas (lo único que el sistema registra hoy)
  for (let i = 0; i < 6; i++) {
    const date = addDays(start, 3 + i * 3);
    redemptions.push({
      id: `rd${String(i + 1).padStart(3, "0")}`,
      user: users[i % 2],
      requested_at: `${date}T18:00:00Z`,
      requested_affiliate: "a01",
      bunz: 25,
      fulfilled_bunz: 25,
      status: "fulfilled",
      reasons: [],
      fulfilled_at: `${date}T18:02:00Z`,
      fulfilled_affiliate: "a01",
      wait_seconds: 120,
      reward_id: `rw${String(i + 3).padStart(4, "0")}`,
    });
  }

  // 2 cobros fiat sin conciliar (no hay bank_ref en el esquema)
  for (let i = 0; i < 2; i++) {
    fiat.push({
      id: `fs${String(i + 1).padStart(3, "0")}`,
      obligation_id: `pending-${i + 1}`, // sin tabla de obligaciones todavía
      received_at: addDays(start, 7 + i * 7),
      amount_mxn: 1450 + i * 300,
      bank_ref: null,
      reconciled: false,
    });
  }

  return {
    spec_version: "1.0.0",
    dataset_kind: "pilot",
    note: "Fixture de piloto (1 afiliado, 2 usuarios, 3 semanas). No son datos reales.",
    window: {
      operational: { from: start, to: addDays(start, 20) },
      financial: { from: "2025-10-01", to: addDays(start, 20) },
    },
    granularity: { capacity: "daily", treasury: "daily" },
    unit_policy: {
      bunz_per_mxn: 1,
      approved: false, // la paridad NO está aprobada: por eso un piloto no calibra
      note: "paridad sin aprobar; R24 bloquea la calibración",
    },
    capacity_scope: "affiliate",
    affiliates: [
      {
        id: "a01",
        category: "coffee",
        size_band: "S",
        branch_id: "b1",
        opened_at: "2026-02-20",
        status: "active",
        city_hash: null,
      },
    ],
    sales,
    rewards_issued: rewards,
    redemptions,
    capacity: [
      {
        affiliate_id: "a01",
        date: addDays(start, 20),
        authorized_bunz: 50_000,
        consumed_bunz: 1_200,
      },
    ],
    treasury,
    fiat_settlements: fiat,
    // Deliberadamente ausentes (no existen en el sistema hoy):
    // obligations, bunz_ledger, abuse_signals
  };
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("make-pilot-sample.mjs");
if (isDirectRun) {
  const out = fileURLToPath(new URL("./real-data-pilot-sample.json", import.meta.url));
  fs.writeFileSync(out, JSON.stringify(makePilotSample(), null, 2) + "\n");
  console.log(`fixture de piloto escrito en ${out}`);
}
