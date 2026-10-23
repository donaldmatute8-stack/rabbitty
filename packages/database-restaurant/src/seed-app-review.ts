/**
 * Siembra (idempotente) los empleados demo para Apple App Review del POS.
 *
 *   RESTAURANT_DATABASE_URL=<url> [REVIEW_BRANCH_ID=<id>] pnpm --filter @rabbitty/database-restaurant db:seed:review
 *
 * - Sucursal: REVIEW_BRANCH_ID o, si no se indica, la primera sucursal (misma que usa el POS por defecto).
 * - Crea/actualiza por (email, sucursal). Re-ejecutar es seguro.
 * - Los PINs se guardan hasheados (scrypt), mismo formato que la API.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { scryptSync, randomBytes } from "crypto";
import { branches, staff } from "./schema";

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const DEMO_STAFF = [
  // MANAGER: puede abrir caja y autorizar (retiros grandes, descuadres, cierre Z)
  { userId: "app-review-manager", name: "Cajero Demo (Gerente)", email: "review-manager@rabbitty.me", role: "MANAGER", pin: "1234" },
  // CASHIER: segundo cajero para demostrar el cambio de turno con doble PIN
  { userId: "app-review-cashier", name: "Cajera Demo", email: "review-cashier@rabbitty.me", role: "CASHIER", pin: "5678" },
];

async function main() {
  const url = process.env.RESTAURANT_DATABASE_URL;
  if (!url) throw new Error("RESTAURANT_DATABASE_URL not set");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    const targetBranches: Array<{ id: string; name: string }> = [];
    if (process.env.REVIEW_BRANCH_ID) {
      targetBranches.push({ id: process.env.REVIEW_BRANCH_ID, name: "Especificada" });
    } else {
      const all = await db.select({ id: branches.id, name: branches.name }).from(branches);
      if (all.length === 0) throw new Error("No hay sucursales en la base de datos");
      targetBranches.push(...all);
    }

    for (const b of targetBranches) {
      console.log(`\nProcesando sucursal: ${b.name} [${b.id}]`);
      for (const d of DEMO_STAFF) {
        const [existing] = await db
          .select()
          .from(staff)
          .where(and(eq(staff.email, d.email), eq(staff.branchId, b.id)));
        const values = { userId: `${d.userId}-${b.id.slice(0, 8)}`, branchId: b.id, name: d.name, email: d.email, role: d.role, pinCode: hashPin(d.pin), isActive: true };
        if (existing) {
          await db.update(staff).set({ ...values, updatedAt: new Date() }).where(eq(staff.id, existing.id));
          console.log(`  Actualizado: ${d.name} (${d.role})`);
        } else {
          await db.insert(staff).values(values);
          console.log(`  Creado: ${d.name} (${d.role})`);
        }
      }
    }
    console.log("\nListo. PINs demo: Gerente 1234 / Cajera 5678 en todas las sucursales.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
