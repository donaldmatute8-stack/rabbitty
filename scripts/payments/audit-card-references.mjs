#!/usr/bin/env node
/**
 * Auditoría READ-ONLY de pagos con tarjeta sin referencia verificable.
 * No escribe ni migra nada.
 *
 * Uso:
 *   RESTAURANT_DATABASE_URL=... node scripts/payments/audit-card-references.mjs
 *
 * Tolera esquemas antiguos: si `verificationMethod` no existe (drift local),
 * reporta el conteo sin desglose y avisa.
 */

import postgres from "postgres";

const url = process.env.RESTAURANT_DATABASE_URL;
if (!url) {
  console.error("Falta RESTAURANT_DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'payments'
  `;
  const hasVerification = columns.some((c) => c.column_name === "verificationMethod");

  const verificationSummary = hasVerification
    ? sql`
        COUNT(*) FILTER (WHERE "verificationMethod" = 'CASHIER_CONFIRMED')::int AS cashier_confirmed,
        COUNT(*) FILTER (WHERE "verificationMethod" = 'EXTERNAL_TERMINAL')::int AS external_terminal,
        COUNT(*) FILTER (WHERE "verificationMethod" = 'STRIPE_WEBHOOK')::int AS stripe_webhook,
        COUNT(*) FILTER (WHERE "verificationMethod" = 'LEGACY_UNVERIFIED')::int AS legacy_unverified
      `
    : sql`
        0::int AS cashier_confirmed,
        0::int AS external_terminal,
        0::int AS stripe_webhook,
        0::int AS legacy_unverified
      `;

  const summary = await sql`
    SELECT
      method,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(reference, '') = '')::int AS missing_reference,
      ${verificationSummary}
    FROM payments
    WHERE method IN ('CREDIT_CARD', 'DEBIT_CARD')
    GROUP BY method
    ORDER BY method
  `;

  console.log("\nResumen de pagos con tarjeta:\n");
  console.table(summary);

  if (!hasVerification) {
    console.warn(
      'Aviso: la columna "verificationMethod" no existe en esta base (esquema antiguo). ' +
        "El desglose por método de verificación se reporta en 0. Migra el esquema antes de etiquetar."
    );
  }

  const verificationColumn = hasVerification
    ? sql`"verificationMethod"`
    : sql`NULL::text`;

  const sample = await sql`
    SELECT
      id,
      "orderId",
      method,
      amount,
      reference,
      ${verificationColumn} AS "verificationMethod",
      status,
      "createdAt"
    FROM payments
    WHERE method IN ('CREDIT_CARD', 'DEBIT_CARD')
      AND COALESCE(reference, '') = ''
    ORDER BY "createdAt" DESC
    LIMIT 25
  `;

  console.log("\nMuestra de pagos SIN referencia (25 más recientes):\n");
  console.table(sample);

  const unverified = summary.reduce((acc, row) => acc + Number(row.missing_reference || 0), 0);

  console.log(
    `\nTotal sin referencia: ${unverified}. ` +
      "Clasificación sugerida: STRIPE_WEBHOOK/EXTERNAL_TERMINAL con cargo → canónico; " +
      "CASHIER_CONFIRMED sin cargo → LEGACY_UNVERIFIED (revisión manual)."
  );
} finally {
  await sql.end();
}
