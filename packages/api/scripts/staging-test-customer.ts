/**
 * ── Utilidad de staging: Rabbitter de prueba con Bunz ──────────────────────
 *
 * SOLO staging (`ancient-meadow`). Crea:
 *  · un Rabbitter con saldo Bunz,
 *  · fondo en la bóveda del negocio (para que el POS pueda pagar con Bunz),
 *  · los asientos de ledger correspondientes, para que el libro cuadre.
 *
 * Uso:
 *   RESTAURANT_DATABASE_URL=... CORE_DATABASE_URL=... \
 *     npx tsx scripts/staging-test-customer.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { users, ownedBusinesses } from "@rabbitty/database-core/schema";
import { branches, restaurants } from "@rabbitty/database-restaurant/schema";

const RESTAURANT_URL = process.env.RESTAURANT_DATABASE_URL ?? "";
const CORE_URL = process.env.CORE_DATABASE_URL ?? RESTAURANT_URL;

function assertStaging() {
  for (const [name, url] of [["RESTAURANT", RESTAURANT_URL], ["CORE", CORE_URL]] as const) {
    if (!url.includes("ancient-meadow")) {
      throw new Error(`ABORTADO: ${name}_DATABASE_URL no es staging (ancient-meadow).`);
    }
  }
}

const PHONE = "+5215500000001";
const USERNAME = "pruebarabbit";
const BUNZ = 500;
const VAULT = 2000;

async function main() {
  assertStaging();
  const rest = postgres(RESTAURANT_URL, { max: 4 });
  const core = postgres(CORE_URL, { max: 4 });
  const rdb = drizzle(rest);
  const cdb = drizzle(core);

  // 1. Negocio y sucursal
  const [branch] = await rdb.select({ id: branches.id, restaurantId: branches.restaurantId }).from(branches).limit(1);
  if (!branch) throw new Error("Staging sin sucursales");
  const [restaurant] = await rdb
    .select({ businessId: restaurants.businessId })
    .from(restaurants)
    .where(eq(restaurants.id, branch.restaurantId))
    .limit(1);
  const businessId = restaurant?.businessId;
  if (!businessId) throw new Error("Sucursal sin negocio asociado");

  // 2. Rabbitter de prueba
  const [existing] = await cdb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, USERNAME))
    .limit(1);

  let userId = existing?.id;
  if (existing) {
    await cdb.update(users).set({ totalBunzEarned: BUNZ, totalBunzSpent: 0 }).where(eq(users.id, existing.id));
  } else {
    const [created] = await cdb.insert(users).values({
      firstName: "Rabbitter",
      lastName: "Prueba",
      username: USERNAME,
      phoneNumber: PHONE,
      scanCode: 700001,
      totalBunzEarned: BUNZ,
      totalBunzSpent: 0,
      role: "USER",
    }).returning({ id: users.id });
    userId = created?.id;
  }
  if (!userId) throw new Error("No se pudo crear el Rabbitter de prueba");

  // 3. Bóveda del negocio (si está en 0 el POS no puede pagar con Bunz)
  const [biz] = await cdb
    .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, bunzBalance: ownedBusinesses.bunzBalance })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.id, businessId))
    .limit(1);

  if (Number(biz?.bunzBalance ?? 0) < BUNZ) {
    await cdb.update(ownedBusinesses).set({ bunzBalance: VAULT }).where(eq(ownedBusinesses.id, businessId));
    await rdb.execute(sql`
      INSERT INTO "ledger_entries"
        ("id","payerSubjectId","payeeSubjectId",amount,currency,sandbox,type,"referenceId","idempotencyKey",metadata)
      VALUES
        (gen_random_uuid()::text, ${"sys_staging_test"}, ${"biz_" + businessId}, ${VAULT}, 'BUNZ', true, 'ALLOCATION',
         'staging-vault', ${"stg-vault-" + businessId},
         ${JSON.stringify({ kind: "STAGING_TEST_VAULT" })}::jsonb)
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `);
  }

  // 4. Asiento EARN: negocio → rabbitter (para que el libro cuadre)
  await rdb.execute(sql`
    INSERT INTO "ledger_entries"
      ("id","payerSubjectId","payeeSubjectId",amount,currency,sandbox,type,"referenceId","idempotencyKey",metadata)
    VALUES
      (gen_random_uuid()::text, ${"biz_" + businessId}, ${"usr_" + userId}, ${BUNZ}, 'BUNZ', true, 'EARN',
       'staging-customer', ${"stg-cust-" + userId},
       ${JSON.stringify({ kind: "STAGING_TEST_CUSTOMER" })}::jsonb)
    ON CONFLICT ("idempotencyKey") DO NOTHING
  `);

  console.log("=== RABBITTER DE PRUEBA ===");
  console.log("nombre:  Rabbitter Prueba");
  console.log("usuario: @" + USERNAME);
  console.log("teléfono:", PHONE);
  console.log("saldo Bunz:", BUNZ);
  console.log("bóveda negocio:", biz?.name, "→", Math.max(VAULT, Number(biz?.bunzBalance ?? 0)));
  console.log("\nEn el POS: vincula por teléfono", PHONE, "o por @pruebarabbit");

  await rest.end();
  await core.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
