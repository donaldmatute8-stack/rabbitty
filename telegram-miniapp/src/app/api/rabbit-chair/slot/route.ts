import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { restaurantDb } from "@/db/restaurant";
import { rabbitChairActivations, rabbitChairSlots } from "@rabbitty/database-restaurant/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/** Pase del Rabbiter: su lugar, estado y configuración. */
export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const activationId = String(new URL(req.url).searchParams.get("activationId") || "").trim();
  if (!activationId) return NextResponse.json({ error: "activationId requerido" }, { status: 400 });

  const [slot] = await restaurantDb
    .select()
    .from(rabbitChairSlots)
    .where(
      and(
        eq(rabbitChairSlots.activationId, activationId),
        eq(rabbitChairSlots.userId, caller.id),
      ),
    )
    .limit(1);

  if (!slot) return NextResponse.json({ slot: null });

  const [activation] = await restaurantDb
    .select({
      name: rabbitChairActivations.name,
      durationMinutes: rabbitChairActivations.durationMinutes,
      minContributionCents: rabbitChairActivations.minContributionCents,
    })
    .from(rabbitChairActivations)
    .where(eq(rabbitChairActivations.id, activationId))
    .limit(1);

  return NextResponse.json({ slot, activation: activation ?? null });
}
