import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { restaurantDb } from "@/db/restaurant";
import { rabbitChairActivations, restaurants } from "@rabbitty/database-restaurant/schema";
import { claimSlot } from "@rabbitty/api/services/rabbitChair";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/** Toma un lugar (hold de 5 min) para el Rabbiter autenticado. */
export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const activationId = String(body?.activationId || "").trim();
  if (!activationId) return NextResponse.json({ error: "activationId requerido" }, { status: 400 });

  const [activation] = await restaurantDb
    .select({ businessId: rabbitChairActivations.businessId })
    .from(rabbitChairActivations)
    .where(eq(rabbitChairActivations.id, activationId))
    .limit(1);
  if (!activation) return NextResponse.json({ error: "Activación no encontrada" }, { status: 404 });

  const [restaurant] = await restaurantDb
    .select({ enabled: restaurants.rabbitChairEnabled })
    .from(restaurants)
    .where(eq(restaurants.businessId, activation.businessId))
    .limit(1);
  if (!restaurant?.enabled) {
    return NextResponse.json({ error: "La experiencia no está activa" }, { status: 409 });
  }

  try {
    const slot = await claimSlot(restaurantDb as any, activationId, { userId: caller.id });
    return NextResponse.json({ success: true, slot });
  } catch (err: any) {
    const message = err?.message || "No se pudo tomar el lugar";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
