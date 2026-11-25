import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { restaurantDb } from "@/db/restaurant";
import { getClientIp, rateLimit } from "@/lib/otp";
import {
  branches,
  rabbitChairActivations,
  rabbitChairSlots,
  restaurants,
} from "@rabbitty/database-restaurant/schema";

export const dynamic = "force-dynamic";

/**
 * ── Rabbit Chair · activación pública ──────────────────────────────────────
 * La app consulta si el negocio activó la experiencia y qué sillas hay
 * abiertas. No requiere sesión: solo datos públicos de la activación.
 *
 * Multi-sucursal: acepta `branchId` (enlace del drop) y, si no viene, devuelve
 * la lista de activaciones abiertas para que la app elija. `activation` sigue
 * siendo la primera para compatibilidad con la app vieja.
 */
export async function GET(req: NextRequest) {
  // Límite por IP: es público y lo consulta la app al abrir.
  const limited = await rateLimit(`rabbit_chair_activation_ip:${getClientIp(req)}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Intenta de nuevo en unos segundos." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const businessId = String(url.searchParams.get("businessId") || "").trim();
  const branchId = String(url.searchParams.get("branchId") || "").trim();
  if (!businessId) return NextResponse.json({ error: "businessId requerido" }, { status: 400 });

  const [restaurant] = await restaurantDb
    .select({ enabled: restaurants.rabbitChairEnabled })
    .from(restaurants)
    .where(eq(restaurants.businessId, businessId))
    .limit(1);

  if (!restaurant?.enabled) {
    return NextResponse.json({ enabled: false, activation: null, freeSlots: 0, activations: [] });
  }

  const rows = await restaurantDb
    .select({
      id: rabbitChairActivations.id,
      branchId: rabbitChairActivations.branchId,
      branchName: branches.name,
      name: rabbitChairActivations.name,
      status: rabbitChairActivations.status,
      format: rabbitChairActivations.format,
      capacity: rabbitChairActivations.capacity,
      minContributionCents: rabbitChairActivations.minContributionCents,
      durationMinutes: rabbitChairActivations.durationMinutes,
      menuMode: rabbitChairActivations.menuMode,
      chargeMode: rabbitChairActivations.chargeMode,
      requiresAgeCheck: rabbitChairActivations.requiresAgeCheck,
      playlist: rabbitChairActivations.playlist,
    })
    .from(rabbitChairActivations)
    .leftJoin(branches, eq(branches.id, rabbitChairActivations.branchId))
    .where(
      and(
        eq(rabbitChairActivations.businessId, businessId),
        // A1: LIVE es el estado normal; SOLD_OUT solo por filas legadas.
        inArray(rabbitChairActivations.status, ["LIVE", "SOLD_OUT"]),
        branchId ? eq(rabbitChairActivations.branchId, branchId) : sql`true`,
      ),
    )
    // LIVE primero; el resto queda por antigüedad de creación.
    .orderBy(
      sql`(${rabbitChairActivations.status} = 'LIVE') DESC`,
      sql`${rabbitChairActivations.createdAt} ASC`,
    );

  const activationIds = rows.map((row) => row.id);
  const freeRows = activationIds.length
    ? await restaurantDb
        .select({
          activationId: rabbitChairSlots.activationId,
          count: sql<number>`count(*)::int`,
        })
        .from(rabbitChairSlots)
        .where(
          and(
            inArray(rabbitChairSlots.activationId, activationIds),
            eq(rabbitChairSlots.status, "FREE"),
          ),
        )
        .groupBy(rabbitChairSlots.activationId)
    : [];
  const freeByActivation = new Map(
    freeRows.map((row) => [String(row.activationId), Number(row.count ?? 0)]),
  );

  const activations = rows.map((row) => {
    const freeSlots = freeByActivation.get(String(row.id)) ?? 0;
    return { ...row, freeSlots, soldOut: freeSlots === 0 };
  });

  const first = activations[0] ?? null;

  return NextResponse.json({
    enabled: true,
    businessId,
    branchId: branchId || null,
    // Compatibilidad: la app vieja lee `activation` y `freeSlots`.
    activation: first,
    freeSlots: first?.freeSlots ?? 0,
    soldOut: first?.soldOut ?? false,
    activations,
  });
}
