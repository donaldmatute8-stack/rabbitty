import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { restaurantDb } from "@/db/restaurant";
import { rabbitChairSlots } from "@rabbitty/database-restaurant/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/** Guarda la configuración de la bebida en el lugar del usuario. */
export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slotId = String(body?.slotId || "").trim();
  const config = body?.config;
  if (!slotId || !config || typeof config !== "object") {
    return NextResponse.json({ error: "slotId y config requeridos" }, { status: 400 });
  }

  // Solo las claves del configurador y texto corto: no es un cajón libre.
  const ALLOWED = ["base", "intensidad", "textura", "temperatura", "dulzor", "aroma", "extra"];
  const clean: Record<string, string> = {};
  for (const key of ALLOWED) {
    const value = (config as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 40) {
      return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });
    }
    clean[key] = value;
  }
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "Configuración vacía" }, { status: 400 });
  }

  const [slot] = await restaurantDb
    .select({ id: rabbitChairSlots.id, userId: rabbitChairSlots.userId })
    .from(rabbitChairSlots)
    .where(and(eq(rabbitChairSlots.id, slotId), eq(rabbitChairSlots.userId, caller.id)))
    .limit(1);
  if (!slot) return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });

  await restaurantDb
    .update(rabbitChairSlots)
    .set({ config: clean, updatedAt: new Date() })
    .where(eq(rabbitChairSlots.id, slotId));

  return NextResponse.json({ success: true });
}
