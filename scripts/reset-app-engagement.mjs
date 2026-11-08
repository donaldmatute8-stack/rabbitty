#!/usr/bin/env node
/**
 * ── Reset de engagement de la app (Rabbitter + Affiliate) ───────────────────
 *
 * Deja en cero:
 *   - users.hops, levelId, visitedBusinesses, hasMadeFirstTransaction
 *   - users.totalBunzEarned/Spent/pendingDebtBunz
 *   - customers (CRM del afiliado)
 *   - presenceSessions (check-ins)
 *
 * NO toca órdenes, pagos, ventas ni menús.
 *
 * Uso:
 *   node scripts/reset-app-engagement.mjs            # vista previa
 *   node scripts/reset-app-engagement.mjs --confirm  # respalda y ejecuta
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
const backupPath = path.join(backupDir, `app-engagement-reset-${stamp}.json`);

const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 20 });

async function counts() {
  return await sql.unsafe(`
    SELECT 'users_with_hops' AS metric, count(*)::text AS value
      FROM "users"
      WHERE COALESCE(hops,0) <> 0 OR "levelId" IS NOT NULL
    UNION ALL SELECT 'users_total_hops', COALESCE(sum(hops),0)::text FROM "users"
    UNION ALL SELECT 'users_total_visited', COALESCE(sum("visitedBusinesses"),0)::text FROM "users"
    UNION ALL SELECT 'users_with_bunz', count(*)::text FROM "users"
      WHERE COALESCE("totalBunzEarned",0) <> 0 OR COALESCE("totalBunzSpent",0) <> 0 OR COALESCE("pendingDebtBunz",0) <> 0
    UNION ALL SELECT 'customers_total', count(*)::text FROM "customers"
    UNION ALL SELECT 'customers_visits', COALESCE(sum("totalVisits"),0)::text FROM "customers"
    UNION ALL SELECT 'customers_spent', COALESCE(sum("totalSpent"),0)::text FROM "customers"
    UNION ALL SELECT 'presence_sessions', count(*)::text FROM "presenceSessions"
  `);
}

async function snapshot() {
  fs.mkdirSync(backupDir, { recursive: true });
  const data = {
    generatedAt: new Date().toISOString(),
    note: "Respaldo previo al reset de engagement. No incluye órdenes, pagos ni ventas.",
    tables: {},
  };
  data.tables.users = await sql.unsafe(`
    SELECT id, email, "phoneNumber", "telegramId", hops, "levelId", "visitedBusinesses",
           "hasMadeFirstTransaction", "hasEarnedFirstBunz", "totalBunzEarned",
           "totalBunzSpent", "pendingDebtBunz", "createdAt"
    FROM "users"
  `);
  data.tables.customers = await sql.unsafe(`SELECT * FROM "customers"`);
  data.tables.presenceSessions = await sql.unsafe(`SELECT * FROM "presenceSessions"`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), "utf8");
  return backupPath;
}

async function reset() {
  const backup = await snapshot();
  console.log(`Respaldo: ${backup}`);

  await sql.begin(async (tx) => {
    await tx`UPDATE "users"
      SET hops = 0,
          "levelId" = NULL,
          "visitedBusinesses" = 0,
          "hasMadeFirstTransaction" = false,
          "hasEarnedFirstBunz" = false,
          "totalBunzEarned" = 0,
          "totalBunzSpent" = 0,
          "pendingDebtBunz" = 0`;
    await tx`DELETE FROM "customers"`;
    await tx`DELETE FROM "presenceSessions"`;

    for (const [key, value] of [
      ["app_engagement_reset_at", new Date().toISOString()],
      ["app_engagement_reset_note", "Reset de Hops, nivel, visitas, clientes y presencia. Se conservan órdenes y ventas."],
    ]) {
      await tx`INSERT INTO "systemSettings" (key, value, "updatedAt")
        VALUES (${key}, ${value}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`;
    }

    await tx`INSERT INTO "auditEntries" (id, "userId", action, resource, "resourceId", details)
      VALUES (gen_random_uuid(), NULL, 'APP_ENGAGEMENT_RESET', 'system', NULL,
        ${JSON.stringify({ at: new Date().toISOString(), backup, scope: "hops, level, visits, customers, presence" })})`;
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
    console.log("\n── Estado después ──");
    for (const row of after) console.log(`${row.metric}: ${row.value}`);
    console.log("\nReset de engagement completado.");
  }
} finally {
  await sql.end({ timeout: 5 });
}
