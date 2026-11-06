#!/usr/bin/env node
/**
 * Captura semanal (M2) — READ-ONLY.
 *
 * Conecta a una réplica/base de solo lectura, ejecuta las consultas del contrato,
 * construye el dataset, lo valida y genera el snapshot que consume el panel GOD.
 *
 *   node scripts/capture-weekly.mjs \
 *     --restaurant-url "$RESTAURANT_DATABASE_URL" \
 *     [--core-url "$CORE_DATABASE_URL"] \
 *     [--out snapshot.json] [--documents-dir apps/admin/documents/validation] \
 *     [--label 2026-11-13]
 *
 * Si no se pasa `--core-url`, los afiliados se derivan de `restaurants`
 * (modo desarrollo local). Nunca escribe en la base: solo SELECT.
 */

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { runValidation } from "./lib/real-data-spec.mjs";
import { attemptsToRedemptions, capacityToDataset, hashUser, pickSources } from "./lib/capture-map.mjs";
import { ledgerToDataset, obligationsToDataset } from "./lib/econ-books-map.mjs";
import { buildSnapshot } from "./lib/validation-snapshot.mjs";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

const REST = flag("--restaurant-url") ?? process.env.RESTAURANT_DATABASE_URL;
const CORE = flag("--core-url") ?? process.env.CORE_DATABASE_URL ?? null;
const OUT = flag("--out");
const DOCS_DIR = flag("--documents-dir");
const LABEL = flag("--label") ?? new Date().toISOString().slice(0, 10);

if (!REST) {
  console.error("falta --restaurant-url (o RESTAURANT_DATABASE_URL). Solo lectura.");
  process.exit(2);
}

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const DAY = 86_400_000;

async function withClient(url, fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function windowOf(dates) {
  const ts = dates.map((d) => new Date(d).getTime()).filter((x) => Number.isFinite(x));
  if (!ts.length) {
    const today = new Date();
    return { from: isoDay(today), to: isoDay(today) };
  }
  const min = new Date(Math.min(...ts));
  const max = new Date(Math.max(...ts));
  if (max.getTime() - min.getTime() < DAY) max.setTime(min.getTime() + DAY);
  return { from: isoDay(min), to: isoDay(max) };
}

async function collect() {
  return withClient(REST, async (db) => {
    const orders = (
      await db.query(
        `SELECT o.id, o."branchId", o.total, o."bunzPaid", o."bunzReward", o."customerId",
                o.status, o."createdAt"
           FROM "orders" o
          WHERE o.status NOT IN ('CANCELLED','VOID','REFUNDED')
          ORDER BY o."createdAt" ASC`
      )
    ).rows;

    const branches = (await db.query(`SELECT id, "restaurantId", name FROM "branches"`)).rows;
    // `bunzDailyLimit` no existe en bases locales antiguas: no se pide.
    const restaurants = (
      await db.query(`SELECT id, "businessId", name, "isActive", "createdAt" FROM "restaurants"`)
    ).rows;
    const payments = (
      await db.query(
        `SELECT id, "orderId", amount, method, status, "createdAt"
           FROM "payments" WHERE status IN ('COMPLETED','SUCCEEDED') ORDER BY "createdAt" ASC`
      )
    ).rows;

    const branchById = new Map(branches.map((b) => [b.id, b]));
    const restById = new Map(restaurants.map((r) => [r.id, r]));

    const businessOf = (branchId) => {
      const br = branchById.get(branchId);
      const r = br ? restById.get(br.restaurantId) : null;
      return r ? r.businessId : null;
    };

    // ── afiliados ──────────────────────────────────────────────────────────
    let affiliates;
    if (CORE) {
      affiliates = await withClient(CORE, async (core) => {
        const rows = (
          await core.query(
            `SELECT id, COALESCE(niche, category) AS category, status, "createdAt" FROM "ownedBusinesses"`
          )
        ).rows;
        const byId = new Map(rows.map((r) => [r.id, r]));
        return restaurants.map((r) => {
          const a = byId.get(r.businessId);
          return {
            id: r.businessId,
            category: a?.category ?? "restaurant",
            size_band: "S",
            branch_id: branches.find((b) => b.restaurantId === r.id)?.id ?? r.id,
            opened_at: isoDay(a?.createdAt ?? r.createdAt),
            status: ["ACTIVE", "VERIFIED"].includes(a ? a.status : r.isActive ? "ACTIVE" : "INACTIVE")
              ? "active"
              : "inactive",
            city_hash: null,
          };
        });
      });
    } else {
      affiliates = restaurants.map((r) => ({
        id: r.businessId,
        category: "restaurant",
        size_band: "S", // derivado: el tamaño real vive en core
        branch_id: branches.find((b) => b.restaurantId === r.id)?.id ?? r.id,
        opened_at: isoDay(r.createdAt),
        status: r.isActive ? "active" : "inactive",
        city_hash: null,
      }));
    }

    const sales = orders
      .map((o) => {
        const affiliate = businessOf(o.branchId);
        if (!affiliate) return null;
        return {
          id: o.id,
          affiliate_id: affiliate,
          ts: new Date(o.createdAt).toISOString(),
          gross_mxn: Number(o.total) || 0,
          discount_bunz: Number(o.bunzPaid) || 0,
          tickets: 1,
          user: hashUser(o.customerId),
        };
      })
      .filter(Boolean);

    const rewards = orders
      .filter((o) => Number(o.bunzReward) > 0)
      .map((o) => {
        const affiliate = businessOf(o.branchId);
        if (!affiliate) return null;
        return {
          id: `rw-${o.id}`,
          affiliate_id: affiliate,
          user: hashUser(o.customerId),
          ts: new Date(o.createdAt).toISOString(),
          bunz: Number(o.bunzReward),
          origin: "package",
          reward_id: o.id,
          expires_at: isoDay(new Date(new Date(o.createdAt).getTime() + 90 * DAY)),
        };
      })
      .filter(Boolean);

    // Solo redenciones cumplidas: el no atendido no se registra todavía (OT-1).
    const redemptions = orders
      .filter((o) => Number(o.bunzPaid) > 0)
      .map((o) => {
        const affiliate = businessOf(o.branchId);
        if (!affiliate) return null;
        return {
          id: `rd-${o.id}`,
          user: hashUser(o.customerId),
          requested_at: new Date(o.createdAt).toISOString(),
          requested_affiliate: affiliate,
          bunz: Number(o.bunzPaid),
          fulfilled_bunz: Number(o.bunzPaid),
          status: "fulfilled",
          reasons: [],
          fulfilled_at: new Date(o.createdAt).toISOString(),
          fulfilled_affiliate: affiliate,
          wait_seconds: 0,
          reward_id: `rw-${o.id}`,
        };
      })
      .filter(Boolean);

    // Capacidad derivada (no hay histórico): límite diario o lo consumido.
    const consumedByDay = new Map();
    for (const o of orders) {
      if (!Number(o.bunzPaid)) continue;
      const key = `${businessOf(o.branchId)}@${isoDay(o.createdAt)}`;
      consumedByDay.set(key, (consumedByDay.get(key) ?? 0) + Number(o.bunzPaid));
    }
    const capacity = [];
    for (const [key, consumed] of consumedByDay) {
      const [affiliate, date] = key.split("@");
      // Sin histórico de capacidad: se declara la consumida como autorizada.
      capacity.push({ affiliate_id: affiliate, date, authorized_bunz: consumed, consumed_bunz: consumed });
    }

    // ── ¿existen las tablas de OT-1 / OT-4? ────────────────────────────────
    const tables = (
      await db.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('bunz_redemption_attempts','bunz_capacity_daily',
                               'bunz_obligations','bunz_ledger_entries')`
      )
    ).rows.map((r) => r.table_name);
    const hasAttempts = tables.includes("bunz_redemption_attempts");
    const hasCapacity = tables.includes("bunz_capacity_daily");
    const hasObligations = tables.includes("bunz_obligations");
    const hasLedger = tables.includes("bunz_ledger_entries");

    const branchToAffiliate = new Map();
    for (const b of branches) {
      const r = restById.get(b.restaurantId);
      if (r) branchToAffiliate.set(b.id, r.businessId);
    }

    let redemptionsOut = redemptions;
    if (hasAttempts) {
      const rows = (
        await db.query(
          `SELECT id, "userHash", "branchId", "orderId", "rewardId", "requestedAt",
                  "bunzRequested", "bunzFulfilled", status, reasons, "waitSeconds",
                  "fulfilledAt", "fulfilledBranchId"
             FROM "bunz_redemption_attempts" ORDER BY "requestedAt" ASC`
        )
      ).rows;
      redemptionsOut = attemptsToRedemptions(rows, branchToAffiliate);
    }

    let capacityOut = capacity;
    if (hasCapacity) {
      const rows = (
        await db.query(
          `SELECT "affiliateId", date, "authorizedBunz", "consumedBunz" FROM "bunz_capacity_daily" ORDER BY date ASC`
        )
      ).rows;
      capacityOut = capacityToDataset(rows);
    }

    let obligationsOut = [];
    let obligationsInvalid = [];
    if (hasObligations) {
      const rows = (
        await db.query(
          `SELECT id, "affiliateId", origin, "accruedAt", "dueAt", "amountBunz", state,
                  "settledAt", instrument, "settledBunz", "settledFiatMxn", "writtenOffAt"
             FROM "bunz_obligations" ORDER BY "accruedAt" ASC`
        )
      ).rows;
      const mapped = obligationsToDataset(rows);
      obligationsOut = mapped.rows;
      obligationsInvalid = mapped.invalid;
    }

    let ledgerOut = [];
    let ledgerInvalid = [];
    if (hasLedger) {
      const rows = (
        await db.query(
          `SELECT id, "groupId", ts, account, direction, amount, "refType", "refId"
             FROM "bunz_ledger_entries" ORDER BY ts ASC`
        )
      ).rows;
      const mapped = ledgerToDataset(rows);
      ledgerOut = mapped.rows;
      ledgerInvalid = mapped.invalid;
    }

    // Una tabla vacía no es evidencia: se declara como hueco hasta que tenga filas.
    const obligationsUsable = hasObligations && obligationsOut.length > 0;
    const ledgerUsable = hasLedger && ledgerOut.length > 0;
    const sources = pickSources({
      hasAttempts,
      hasCapacity,
      hasObligations: obligationsUsable,
      hasLedger: ledgerUsable,
    });
    if (hasObligations && !obligationsUsable) sources.obligations = "empty-table";
    if (hasLedger && !ledgerUsable) sources.ledger = "empty-table";

    const fiat = payments.map((p) => ({
      id: p.id,
      obligation_id: p.orderId,
      received_at: isoDay(p.createdAt),
      amount_mxn: Number(p.amount) || 0,
      bank_ref: null,
      reconciled: false,
    }));

    return {
      affiliates,
      sales,
      rewards,
      redemptions: redemptionsOut,
      capacity: capacityOut,
      obligations: obligationsOut,
      ledger: ledgerOut,
      invalid: { obligations: obligationsInvalid, ledger: ledgerInvalid },
      fiat,
      orders,
      sources,
    };
  });
}

const data = await collect();
const win = windowOf(data.orders.map((o) => o.createdAt));

const dataset = {
  spec_version: "1.0.0",
  dataset_kind: "pilot",
  note: `Captura semanal (solo lectura). Fuentes: redenciones=${data.sources.redemptions}, capacidad=${data.sources.capacity}.`, 
  window: { operational: win, financial: win },
  granularity: { capacity: "daily", treasury: "daily" },
  unit_policy: {
    bunz_per_mxn: 1,
    approved: false,
    note: "paridad sin aprobar; R24 bloquea la calibración",
  },
  capacity_scope: "affiliate",
  affiliates: data.affiliates,
  sales: data.sales,
  rewards_issued: data.rewards,
  redemptions: data.redemptions,
  capacity: data.capacity,
  fiat_settlements: data.fiat,
  // Se incluyen si las tablas existen; si no, el validador las declara como hueco.
  ...(data.sources.obligations === "db" ? { obligations: data.obligations } : {}),
  ...(data.sources.ledger === "db" ? { bunz_ledger: data.ledger } : {}),
  // Si la tabla existe pero está vacía, NO se incluye: un libro vacío rompe la
  // reconciliación (R11) sin aportar evidencia. Se declara como hueco.
  // Deliberadamente ausentes: treasury, abuse_signals (sin fuente todavía)
};

const validation = runValidation(dataset);
const snapshot = buildSnapshot(dataset, { sourceCommit: process.env.GIT_COMMIT ?? null });

if (OUT) {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
}
if (DOCS_DIR) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOCS_DIR, `${LABEL}.json`), JSON.stringify(snapshot, null, 2) + "\n");
}

console.log(`captura ${LABEL} · ventana ${win.from} → ${win.to}`);
console.log(`filas: ${JSON.stringify(validation.counts.datasets)}`);
console.log(`válido ${validation.ok ? "SÍ" : "NO"} · calibrable ${validation.calibration_ready ? "SÍ" : "NO"}`);
console.log(
  `fuentes: redenciones=${data.sources.redemptions} · capacidad=${data.sources.capacity} · ` +
    `obligaciones=${data.sources.obligations} · libro=${data.sources.ledger}`
);
if (data.invalid.obligations.length) console.log(`  ⚠ obligaciones inválidas: ${data.invalid.obligations.length}`);
if (data.invalid.ledger.length) console.log(`  ⚠ asientos inválidos: ${data.invalid.ledger.length}`);
console.log(`alertas: ${snapshot.alerts.map((a) => a.code).join(", ") || "ninguna"}`);
if (OUT) console.log(`→ ${OUT}`);
if (DOCS_DIR) console.log(`→ ${path.join(DOCS_DIR, `${LABEL}.json`)}`);
