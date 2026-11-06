#!/usr/bin/env node
/**
 * Etiqueta pagos con tarjeta SIN referencia como LEGACY_UNVERIFIED.
 * DRY-RUN por defecto. Solo escribe con --apply y confirmación explícita.
 *
 * Uso:
 *   RESTAURANT_DATABASE_URL=... node scripts/payments/tag-legacy-unverified.mjs
 *   RESTAURANT_DATABASE_URL=... node scripts/payments/tag-legacy-unverified.mjs --apply --yes
 *
 * No toca montos, estados, órdenes ni ledger. Solo `verificationMethod`.
 */

import postgres from "postgres";

const url = process.env.RESTAURANT_DATABASE_URL;
if (!url) {
  console.error("Falta RESTAURANT_DATABASE_URL");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--yes");
if (apply && !confirmed) {
  console.error("Para escribir usa --apply --yes (dry-run por defecto).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const columns = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'payments'
  `;
  if (!columns.some((c) => c.column_name === "verificationMethod")) {
    console.error(
      'La columna "verificationMethod" no existe en esta base. Migra el esquema antes de etiquetar.'
    );
    process.exit(1);
  }

  const [count] = await sql`
    SELECT COUNT(*)::int AS total
    FROM payments
    WHERE method IN ('CREDIT_CARD', 'DEBIT_CARD')
      AND COALESCE(reference, '') = ''
      AND "verificationMethod" <> 'LEGACY_UNVERIFIED'
  `;

  console.log(`Pagos candidatos a LEGACY_UNVERIFIED: ${count.total}`);

  if (!apply) {
    const sample = await sql`
      SELECT id, "orderId", method, amount, "verificationMethod", "createdAt"
      FROM payments
      WHERE method IN ('CREDIT_CARD', 'DEBIT_CARD')
        AND COALESCE(reference, '') = ''
        AND "verificationMethod" <> 'LEGACY_UNVERIFIED'
      ORDER BY "createdAt" DESC
      LIMIT 20
    `;
    console.table(sample);
    console.log("Dry-run: no se escribió nada. Usa --apply --yes para etiquetar.");
    process.exit(0);
  }

  const updated = await sql`
    UPDATE payments
    SET "verificationMethod" = 'LEGACY_UNVERIFIED'
    WHERE method IN ('CREDIT_CARD', 'DEBIT_CARD')
      AND COALESCE(reference, '') = ''
      AND "verificationMethod" <> 'LEGACY_UNVERIFIED'
    RETURNING id
  `;
  console.log(`Etiquetados: ${updated.length}`);
} finally {
  await sql.end();
}
