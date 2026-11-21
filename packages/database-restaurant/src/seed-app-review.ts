/**
 * Siembra (idempotente) los empleados demo para Apple App Review del POS.
 *
 *   RESTAURANT_DATABASE_URL=<url> REVIEW_BRANCH_ID=<id> pnpm --filter @rabbitty/database-restaurant db:seed:review
 *
 * ── REGLA DE ORO (2026-11-21) ──
 * Estas fichas llevan PINs PÚBLICOS (están en el repo) y una de ellas es
 * MANAGER (autoriza anulaciones, retiros y cortes). Sembrarlas en un negocio
 * real es una fuga de identidad y un riesgo operativo: antes el script las
 * creaba en TODAS las sucursales de la base (así aparecieron en 626 Café).
 *
 * Por eso ahora:
 *   · REVIEW_BRANCH_ID es OBLIGATORIO (nunca "todas").
 *   · La sucursal debe pertenecer a un negocio de demostración: el nombre del
 *     restaurante o de la sucursal debe contener demo/sandbox/review/prueba/test.
 *   · ALLOW_NON_DEMO_BRANCH=1 solo para un caso excepcional y consciente.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { scryptSync, randomBytes } from "crypto";
import { branches, restaurants, staff } from "./schema";

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

const DEMO_NAME = /demo|sandbox|review|prueba|test/i;

async function main() {
  const url = process.env.RESTAURANT_DATABASE_URL;
  if (!url) throw new Error("RESTAURANT_DATABASE_URL not set");

  const branchId = (process.env.REVIEW_BRANCH_ID || "").trim();
  if (!branchId) {
    throw new Error(
      "REVIEW_BRANCH_ID es obligatorio. Estas fichas tienen PINs públicos y NO deben sembrarse en sucursales reales.",
    );
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    const [target] = await db
      .select({ id: branches.id, name: branches.name, restaurantName: restaurants.name })
      .from(branches)
      .leftJoin(restaurants, eq(restaurants.id, branches.restaurantId))
      .where(eq(branches.id, branchId))
      .limit(1);

    if (!target) throw new Error(`Sucursal no encontrada: ${branchId}`);

    const looksDemo = DEMO_NAME.test(target.name || "") || DEMO_NAME.test(target.restaurantName || "");
    if (!looksDemo && process.env.ALLOW_NON_DEMO_BRANCH !== "1") {
      throw new Error(
        `La sucursal "${target.name}" (${target.restaurantName}) no parece de demostración. ` +
          `Usa el negocio demo de App Review o, si de verdad es un caso excepcional, ALLOW_NON_DEMO_BRANCH=1.`,
      );
    }

    console.log(`\nSucursal demo: ${target.name} [${target.id}] · ${target.restaurantName ?? "—"}`);
    for (const d of DEMO_STAFF) {
      const [existing] = await db
        .select()
        .from(staff)
        .where(and(eq(staff.email, d.email), eq(staff.branchId, target.id)));
      const values = {
        userId: `${d.userId}-${target.id.slice(0, 8)}`,
        branchId: target.id,
        name: d.name,
        email: d.email,
        role: d.role,
        pinCode: hashPin(d.pin),
        isActive: true,
      };
      if (existing) {
        await db.update(staff).set({ ...values, updatedAt: new Date() }).where(eq(staff.id, existing.id));
        console.log(`  Actualizado: ${d.name} (${d.role})`);
      } else {
        await db.insert(staff).values(values);
        console.log(`  Creado: ${d.name} (${d.role})`);
      }
    }
    console.log("\nListo. PINs demo: Gerente 1234 / Cajera 5678 (SOLO en esta sucursal demo).");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
