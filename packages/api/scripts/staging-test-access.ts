/**
 * ── Utilidad de staging: crea usuario PIN y terminal POS ───────────────────
 *
 * SOLO para el ambiente de staging. Aborta si la URL no es el branch de Neon
 * de staging (`ancient-meadow`). Nunca toca producción.
 *
 * Uso:
 *   RESTAURANT_DATABASE_URL=... npx tsx scripts/staging-test-access.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import {
  branches,
  restaurants,
  staff,
} from "@rabbitty/database-restaurant/schema";
import {
  posTerminals,
  posTerminalSessions,
} from "@rabbitty/database-core/schema";

const URL = process.env.RESTAURANT_DATABASE_URL ?? "";

function assertStaging() {
  if (!URL.includes("ancient-meadow")) {
    throw new Error(
      "ABORTADO: la URL no es el branch de staging (ancient-meadow). No se toca producción.",
    );
  }
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  assertStaging();
  const client = postgres(URL, { max: 4 });
  const db = drizzle(client);

  // 1. Sucursal de prueba (la primera con restaurante)
  const [branch] = await db
    .select({ id: branches.id, name: branches.name, restaurantId: branches.restaurantId })
    .from(branches)
    .limit(1);
  if (!branch) throw new Error("Staging sin sucursales");

  const [restaurant] = await db
    .select({ id: restaurants.id, businessId: restaurants.businessId, name: restaurants.name })
    .from(restaurants)
    .where(eq(restaurants.id, branch.restaurantId))
    .limit(1);

  // 2. Empleado con PIN 1234 (rol MANAGER: puede abrir caja y autorizar retiros)
  const PIN = "1234";
  const [existingStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.email, "prueba.staging@rabbitty.me"))
    .limit(1);

  let staffId = existingStaff?.id;
  if (existingStaff) {
    await db.update(staff).set({ pinCode: hashPin(PIN), isActive: true, role: "MANAGER" })
      .where(eq(staff.id, existingStaff.id));
  } else {
    const [created] = await db.insert(staff).values({
      userId: "staging-test-user",
      branchId: branch.id,
      name: "Cajero Prueba",
      email: "prueba.staging@rabbitty.me",
      role: "MANAGER",
      pinCode: hashPin(PIN),
      isActive: true,
    }).returning({ id: staff.id });
    staffId = created?.id;
  }

  // 3. Terminal POS autorizada + sesión (token de 64 hex)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [terminal] = await db.insert(posTerminals).values({
    businessId: restaurant?.businessId ?? null,
    branchId: branch.id,
    name: "Terminal Staging",
    platform: "web",
    deviceKeyHash: crypto.createHash("sha256").update(`staging-${token}`).digest("hex"),
    status: "ACTIVE",
  }).returning({ id: posTerminals.id });

  await db.insert(posTerminalSessions).values({
    terminalId: terminal!.id,
    token,
    expiresAt,
  });

  console.log("=== ACCESO DE STAGING ===");
  console.log("sucursal:      ", branch.name, `(${branch.id})`);
  console.log("negocio:       ", restaurant?.name ?? "(sin restaurante)");
  console.log("empleado PIN:  ", PIN, "· rol MANAGER ·", staffId);
  console.log("terminal:      ", terminal!.id);
  console.log("token expira:  ", expiresAt.toISOString());
  console.log("");
  console.log("TOKEN DE TERMINAL (pegar en la consola del navegador):");
  console.log(token);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
