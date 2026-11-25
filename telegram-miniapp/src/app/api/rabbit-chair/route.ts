import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { restaurantDb } from "@/db/restaurant";
import {
  rabbitChairActivations,
  rabbitChairSlots,
  restaurants,
} from "@rabbitty/database-restaurant/schema";

export const dynamic = "force-dynamic";

/**
 * ── Rabbit Chair · activación pública ──────────────────────────────────────
 * La app consulta si el negocio activó la experiencia y si hay una silla
 * abierta. No requiere sesión: solo datos públicos de la activación.
 */
export async function GET(req: NextRequest) {
  const businessId = String(new URL(req.url).searchParams.get("businessId") || "").trim();
  if (!businessId) return NextResponse.json({ error: "businessId requerido" }, { status: 400 });

  const [restaurant] = await restaurantDb
    .select({ enabled: restaurants.rabbitChairEnabled })
    .from(restaurants)
    .where(eq(restaurants.businessId, businessId))
    .limit(1);

  if (!restaurant?.enabled) {
    return NextResponse.json({ enabled: false, activation: null, freeSlots: 0 });
  }

  const [activation] = await restaurantDb
    .select()
    .from(rabbitChairActivations)
    .where(
      and(
        eq(rabbitChairActivations.businessId, businessId),
        eq(rabbitChairActivations.status, "LIVE"),
      ),
    )
    .limit(1);

  if (!activation) {
    return NextResponse.json({ enabled: true, activation: null, freeSlots: 0 });
  }

  const [free] = await restaurantDb
    .select({ count: sql<number>`count(*)::int` })
    .from(rabbitChairSlots)
    .where(
      and(
        eq(rabbitChairSlots.activationId, activation.id),
        eq(rabbitChairSlots.status, "FREE"),
      ),
    );

  return NextResponse.json({
    enabled: true,
    activation: {
      id: activation.id,
      name: activation.name,
      format: activation.format,
      capacity: activation.capacity,
      minContributionCents: activation.minContributionCents,
      durationMinutes: activation.durationMinutes,
      menuMode: activation.menuMode,
      chargeMode: activation.chargeMode,
      requiresAgeCheck: activation.requiresAgeCheck,
      playlist: activation.playlist,
    },
    freeSlots: Number(free?.count ?? 0),
  });
}
