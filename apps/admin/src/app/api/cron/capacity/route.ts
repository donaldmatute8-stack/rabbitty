import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ── /api/cron/capacity ── OT-4: snapshot diario de capacidad por afiliado.
 *
 * READ-ONLY sobre órdenes y negocios. Escribe **una fila por afiliado y día**
 * en `bunz_capacity_daily` (upsert idempotente).
 *
 * autorizado = creditLimit − creditUsed (core)
 * consumido  = Σ bunzPaid del día (restaurante)
 *
 * Autorización: CRON_SECRET (mismo patrón que el resto de cron).
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    (req.headers.get("x-cron-secret") || "") ||
    new URL(req.url).searchParams.get("secret") ||
    "";
  return provided === expected;
}

async function run() {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 401 });
  }

  const coreDb = getCoreDb();
  const restaurantDb = getRestaurantDb();
  const { ownedBusinesses } = await import("@rabbitty/database-core/schema");
  const { orders, branches, restaurants, bunzCapacityDaily } = await import(
    "@rabbitty/database-restaurant/schema"
  );

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const startOfDay = new Date(`${date}T00:00:00.000Z`);

  const businesses = await coreDb
    .select({
      id: ownedBusinesses.id,
      creditLimit: ownedBusinesses.creditLimit,
      creditUsed: ownedBusinesses.creditUsed,
    })
    .from(ownedBusinesses);

  const consumption = await restaurantDb
    .select({
      businessId: restaurants.businessId,
      consumed: sql<number>`coalesce(sum(${orders.bunzPaid}), 0)`,
    })
    .from(orders)
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
    .where(gte(orders.createdAt, startOfDay))
    .groupBy(restaurants.businessId);

  const consumedBy = new Map(consumption.map((c) => [c.businessId, Number(c.consumed) || 0]));

  let written = 0;
  for (const b of businesses) {
    const authorized = Math.max(0, Number(b.creditLimit || 0) - Number(b.creditUsed || 0));
    const consumed = Math.max(0, consumedBy.get(b.id) || 0);
    try {
      await restaurantDb
        .insert(bunzCapacityDaily)
        .values({ affiliateId: b.id, date, authorizedBunz: authorized, consumedBunz: consumed, source: "credit_limit" })
        .onConflictDoUpdate({
          target: [bunzCapacityDaily.affiliateId, bunzCapacityDaily.date],
          set: {
            authorizedBunz: sql`excluded."authorizedBunz"`,
            consumedBunz: sql`excluded."consumedBunz"`,
            source: sql`excluded."source"`,
          },
        });
      written++;
    } catch (e) {
      console.warn(`[capacity] ${b.id} no registrado: ${e instanceof Error ? e.message : e}`);
    }
  }

  return NextResponse.json({ ok: true, date, affiliates: businesses.length, written });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}
