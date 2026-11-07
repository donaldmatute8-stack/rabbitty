#!/usr/bin/env node
/**
 * ── Reset total de la economía Bunz ──────────────────────────────────────────
 *
 * Deja en cero los saldos Bunz de usuarios y negocios, borra libros, reservas,
 * obligaciones, capacidad y propuestas. NO toca ventas fiat, pedidos, menús,
 * personal, sucursales ni la operación de 626.
 *
 * Uso:
 *   node scripts/reset-bunz-economy.mjs            # vista previa, no escribe
 *   node scripts/reset-bunz-economy.mjs --confirm  # respalda y ejecuta
 *
 * Requiere CORE_DATABASE_URL.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.CORE_DATABASE_URL;
if (!url) {
  console.error("Falta CORE_DATABASE_URL");
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(process.cwd(), "DOCS/data/backups");
const backupPath = path.join(backupDir, `bunz-reset-${stamp}.json`);

const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 20 });

/** Tablas que se vacían por completo. */
const DELETE_TABLES = [
  "campaignRedemptions",
  "bunz_reserves",
  "pendingVaults",
  "bunz_redemption_attempts",
  "bunz_capacity_daily",
  "bunz_obligation_events",
  "bunz_obligations",
  "bunz_ledger_entries",
  "bunz_reconciliation_runs",
  "bunz_abuse_signals",
  "merchant_recovery_proposals",
  "merchant_recovery_terms",
  "merchant_capacity_events",
  "merchant_capacity_accounts",
];

async function counts() {
  const rows = await sql.unsafe(`
    SELECT 'users_with_bunz' AS metric, count(*)::text AS value
      FROM "users"
      WHERE COALESCE("totalBunzEarned",0) <> 0
         OR COALESCE("totalBunzSpent",0) <> 0
         OR COALESCE("pendingDebtBunz",0) <> 0
    UNION ALL SELECT 'users_total_earned', COALESCE(sum("totalBunzEarned"),0)::text FROM "users"
    UNION ALL SELECT 'users_total_spent', COALESCE(sum("totalBunzSpent"),0)::text FROM "users"
    UNION ALL SELECT 'users_total_pending_debt', COALESCE(sum("pendingDebtBunz"),0)::text FROM "users"
    UNION ALL SELECT 'businesses_total_bunz_balance', COALESCE(sum("bunzBalance"),0)::text FROM "ownedBusinesses"
    UNION ALL SELECT 'businesses_total_credit_limit', COALESCE(sum("creditLimit"),0)::text FROM "ownedBusinesses"
    UNION ALL SELECT 'businesses_total_credit_used', COALESCE(sum("creditUsed"),0)::text FROM "ownedBusinesses"
    UNION ALL SELECT 'pending_vaults', count(*)::text FROM "pendingVaults"
    UNION ALL SELECT 'bunz_reserves', count(*)::text FROM "bunz_reserves"
    UNION ALL SELECT 'redemption_attempts', count(*)::text FROM "bunz_redemption_attempts"
    UNION ALL SELECT 'capacity_daily', count(*)::text FROM "bunz_capacity_daily"
    UNION ALL SELECT 'obligations', count(*)::text FROM "bunz_obligations"
    UNION ALL SELECT 'obligation_events', count(*)::text FROM "bunz_obligation_events"
    UNION ALL SELECT 'bunz_ledger', count(*)::text FROM "bunz_ledger_entries"
    UNION ALL SELECT 'legacy_ledger_bunz', count(*)::text FROM "ledger_entries" WHERE currency='BUNZ'
    UNION ALL SELECT 'recon_runs', count(*)::text FROM "bunz_reconciliation_runs"
    UNION ALL SELECT 'abuse_signals', count(*)::text FROM "bunz_abuse_signals"
    UNION ALL SELECT 'capacity_accounts', count(*)::text FROM "merchant_capacity_accounts"
    UNION ALL SELECT 'capacity_events', count(*)::text FROM "merchant_capacity_events"
    UNION ALL SELECT 'recovery_terms', count(*)::text FROM "merchant_recovery_terms"
    UNION ALL SELECT 'recovery_proposals', count(*)::text FROM "merchant_recovery_proposals"
    UNION ALL SELECT 'campaign_redemptions', count(*)::text FROM "campaignRedemptions"
  `);
  return rows;
}

async function snapshot() {
  fs.mkdirSync(backupDir, { recursive: true });
  const data = {
    generatedAt: new Date().toISOString(),
    note: "Respaldo previo al reset total de Bunz. No incluye ventas fiat ni operación.",
    tables: {},
  };

  const queries = {
    users: `SELECT id, email, "phoneNumber", "telegramId", "totalBunzEarned", "totalBunzSpent", "pendingDebtBunz", "hasEarnedFirstBunz", "createdAt" FROM "users"`,
    ownedBusinesses: `SELECT id, "ownerId", name, sandbox, "bunzBalance", "creditLimit", "creditUsed", package, status FROM "ownedBusinesses"`,
    affiliateCampaigns: `SELECT id, "businessId", "budgetBunz", "budgetSpent", status FROM "affiliateCampaigns"`,
    bunz_economic_limits: `SELECT * FROM "bunz_economic_limits"`,
    bunz_control_state: `SELECT * FROM "bunz_control_state"`,
    ledger_entries: `SELECT * FROM "ledger_entries" WHERE currency='BUNZ'`,
  };

  for (const [name, query] of Object.entries(queries)) {
    data.tables[name] = await sql.unsafe(query);
  }

  for (const table of DELETE_TABLES) {
    data.tables[table] = await sql.unsafe(`SELECT * FROM "${table}"`);
  }

  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), "utf8");
  return backupPath;
}

async function reset() {
  const backup = await snapshot();
  console.log(`Respaldo: ${backup}`);

  await sql.begin(async (tx) => {
    // Marcador de corte para reportes y conciliación.
    const settings = [
      ["bunz_economy_reset_at", new Date().toISOString()],
      ["bunz_economy_reset_note", "Reset total de Bunz: saldos, libros, reservas, obligaciones, capacidad y propuestas reiniciados. Se conserva el historial fiat."],
      ["bunz_economy_reset_scope", "users.totalBunzEarned, users.totalBunzSpent, users.pendingDebtBunz, ownedBusinesses.bunzBalance, ownedBusinesses.creditLimit, ownedBusinesses.creditUsed, ledger Bunz, capacidad MCCE, propuestas, reservas y vaults."],
      ["bunz_economy_status", "paused_until_reonboarding_626"],
    ];
    for (const [key, value] of settings) {
      await tx`
        INSERT INTO "systemSettings" (key, value, "updatedAt")
        VALUES (${key}, ${value}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()
      `;
    }

    await tx`
      UPDATE "users"
      SET "totalBunzEarned" = 0,
          "totalBunzSpent" = 0,
          "pendingDebtBunz" = 0,
          "hasEarnedFirstBunz" = false
    `;

    await tx`
      UPDATE "ownedBusinesses"
      SET "bunzBalance" = 0,
          "creditLimit" = 0,
          "creditUsed" = 0,
          package = NULL
    `;

    await tx`UPDATE "affiliateCampaigns" SET "budgetSpent" = 0`;

    // Bloquea emisión/redención del piloto hasta el re-onboarding de 626.
    // La operación fiat y el POS siguen funcionando.
    await tx`
      UPDATE "bunz_economic_limits"
      SET "pilotEnabled" = false,
          "updatedAt" = now()
    `;

    for (const table of DELETE_TABLES) {
      await tx.unsafe(`DELETE FROM "${table}"`);
    }

    await tx.unsafe(`DELETE FROM "ledger_entries" WHERE currency = 'BUNZ'`);

    await tx`
      INSERT INTO "auditEntries" (id, "userId", action, resource, "resourceId", details)
      VALUES (
        ${crypto.randomUUID()},
        NULL,
        'BUNZ_ECONOMY_RESET',
        'system',
        NULL,
        ${JSON.stringify({
          at: new Date().toISOString(),
          scope: "all",
          backup,
          note: "Reset total de Bunz; no se tocaron ventas fiat ni operación. Piloto de emisión/redención pausado hasta re-onboarding de 626.",
        })}
      )
    `;
  });
}

try {
  const before = await counts();
  console.log("── Estado actual ──");
  for (const row of before) console.log(`${row.metric}: ${row.value}`);

  if (!confirm) {
    console.log("\nVista previa. No se escribió nada.");
    console.log("Ejecuta con --confirm para respaldar y reiniciar.");
  } else {
    await reset();
    const after = await counts();
    console.log("\n── Estado después del reset ──");
    for (const row of after) console.log(`${row.metric}: ${row.value}`);
    console.log("\nReset completado.");
  }
} finally {
  await sql.end({ timeout: 5 });
}
