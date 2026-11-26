#!/usr/bin/env node
/**
 * ── Auditoría read-only del fondo La Madriguera ─────────────────────────────
 *
 *   CORE_DATABASE_URL=... node scripts/growth-fund-audit.mjs
 *   ... --json
 *
 * No escribe nada. Solo lee:
 *   · saldo del fondo desde ledger_entries (sys_growth_fund)
 *   · aportes por fuente
 *   · referidos pendientes / pagados
 *   · presupuestos de plataforma
 *
 * Sale con código 1 si el fondo está sobregirado o tiene asientos inválidos.
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta CORE_DATABASE_URL / DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const [ledger] = await sql`
  SELECT
    COALESCE(SUM(CASE WHEN "payeeSubjectId" = 'sys_growth_fund'
                       AND type IN ('MINT','TRANSFER') THEN amount ELSE 0 END), 0)::float AS incoming,
    COALESCE(SUM(CASE WHEN "payerSubjectId" = 'sys_growth_fund'
                       AND type = 'EARN' THEN amount ELSE 0 END), 0)::float AS outgoing,
    COALESCE(SUM(CASE WHEN ("payerSubjectId" = 'sys_growth_fund'
                        OR "payeeSubjectId" = 'sys_growth_fund')
                      AND NOT (
                        ("payeeSubjectId" = 'sys_growth_fund' AND type = 'MINT'
                         AND (left("payerSubjectId", 4) = 'biz_' OR left("payerSubjectId", 4) = 'sys_'))
                        OR ("payeeSubjectId" = 'sys_growth_fund' AND type = 'TRANSFER'
                            AND left("payerSubjectId", 4) = 'usr_')
                        OR ("payerSubjectId" = 'sys_growth_fund' AND type = 'EARN'
                            AND left("payeeSubjectId", 4) = 'usr_')
                      ) THEN 1 ELSE 0 END), 0)::int AS invalid
  FROM "ledger_entries"
  WHERE "payerSubjectId" = 'sys_growth_fund' OR "payeeSubjectId" = 'sys_growth_fund'
`;

const contributions = await sql`
  SELECT "source", COALESCE(SUM("amount"), 0)::int AS amount, COUNT(*)::int AS entries
    FROM "fund_contributions"
   WHERE "program" = 'madriguera'
   GROUP BY "source"
   ORDER BY "source"
`;

const [referrals] = await sql`
  SELECT
    COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
    COALESCE(SUM("rewardAmount") FILTER (WHERE status = 'PENDING'), 0)::int AS pending_amount
  FROM "referrals"
`;

const budgets = await sql`
  SELECT "program", "periodStart", "periodEnd", "budgeted", "spent"
    FROM "platform_budgets"
   ORDER BY "periodStart" DESC
   LIMIT 12
`;

const balance = Number(ledger.incoming) - Number(ledger.outgoing);
const healthy = balance >= 0 && Number(ledger.invalid) === 0;

const report = {
  fund: "sys_growth_fund",
  incoming: Number(ledger.incoming),
  outgoing: Number(ledger.outgoing),
  balance,
  invalidEntries: Number(ledger.invalid),
  healthy,
  contributions,
  referrals,
  budgets,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("── La Madriguera · auditoría read-only ──");
  console.log(`Fondo:            ${report.fund}`);
  console.log(`Entradas:         ${report.incoming} Bunz`);
  console.log(`Salidas:          ${report.outgoing} Bunz`);
  console.log(`Saldo:            ${report.balance} Bunz`);
  console.log(`Asientos inválidos: ${report.invalidEntries}`);
  console.log(`Salud:            ${healthy ? "OK" : "REVISAR"}`);
  console.log("Aportes:");
  for (const row of contributions) {
    console.log(`  ${row.source}: ${row.amount} Bunz (${row.entries} asientos)`);
  }
  if (contributions.length === 0) console.log("  (sin aportes)");
  console.log(`Referidos: ${referrals.pending} pendientes, ${referrals.completed} completados, ${referrals.pending_amount} Bunz pendientes`);
  console.log(`Presupuestos: ${budgets.length} periodos`);
}

await sql.end();
process.exit(healthy ? 0 : 1);
