import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { stations } from "@rabbitty/database-restaurant/schema";
import { resolveKdsCaller, KdsAuthError } from "@rabbitty/api/services/kdsContext";
import { resolveBusinessIdFromBranch } from "@rabbitty/api/services/businessContext";
import { issueStationTokens } from "@rabbitty/api/services/centrifugoToken";

export const runtime = "nodejs";

/**
 * ── Tokens de Centrifugo para una estación del KDS (Fase 0C-5) ────────────
 *
 * El cliente pide `?stationId=…`; el canal lo construye el servidor después de
 * validar que la estación pertenece a SU sucursal (y a su terminal, si está
 * atada). Así nadie puede suscribirse al canal de otro tenant adivinando el
 * nombre.
 *
 * Devuelve el token de conexión y el de suscripción porque Centrifugo tiene
 * `allow_subscribe_for_client: false` en el namespace `biz`.
 */
export async function GET(req: Request) {
  const session = await auth();
  const restaurantDb = getRestaurantDb();
  const coreDb = getCoreDb();

  let caller;
  try {
    caller = await resolveKdsCaller({ req, session, restaurantDb, coreDb });
  } catch (error) {
    if (error instanceof KdsAuthError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const stationId = (new URL(req.url).searchParams.get("stationId") || "").trim();
  if (!stationId) {
    return NextResponse.json({ error: "Falta stationId" }, { status: 400 });
  }

  // Una terminal atada solo puede pedir su propia estación.
  if (caller.posAuth.stationId && caller.posAuth.stationId !== stationId) {
    return NextResponse.json({ error: "Esta terminal está asignada a otra estación" }, { status: 403 });
  }

  const [station] = await restaurantDb
    .select({ id: stations.id })
    .from(stations)
    .where(and(eq(stations.id, stationId), eq(stations.branchId, caller.branchId)))
    .limit(1);
  if (!station) {
    return NextResponse.json({ error: "La estación no pertenece a esta sucursal" }, { status: 403 });
  }

  if (!process.env.CENTRIFUGO_TOKEN_SECRET) {
    return NextResponse.json({ error: "Realtime no configurado" }, { status: 501 });
  }

  const businessId = await resolveBusinessIdFromBranch(restaurantDb, caller.branchId);
  const tokens = issueStationTokens({
    businessId,
    branchId: caller.branchId,
    stationId,
    subject: caller.userId ?? `terminal:${caller.posAuth.terminalId ?? "unknown"}`,
  });

  return NextResponse.json(tokens, { headers: { "Cache-Control": "no-store" } });
}
