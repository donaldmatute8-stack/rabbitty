import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { submitRatingForOrder } from "@rabbitty/api/services/ratingSubmit";

export const runtime = "nodejs";

/**
 * ── /api/internal/rating ── Canal servidor-a-servidor para el rating post-pago
 * del canal NATIVO/miniapp (Fase 1 Rabbitty Score).
 *
 * Por qué existe: `ratings.submitRating` (tRPC) es protectedProcedure y vive de
 * la sesión del admin; el comensal del canal nativo/miniapp no la tiene. El
 * pago se liquidaba por `payments.*` (publicLimitedProcedure con su propio
 * scoping), pero el rating quedaba colgado — ESTE endpoint es el puente.
 *
 * Seguridad:
 * - Header `x-rating-secret` === RATING_INTERNAL_SECRET (compartido miniapp↔admin).
 * - `userId` (core user) lo RESUELVE y autentica el proxy del miniapp
 *   (getAuthenticatedUser, rate-limit 10/60s); aquí se re-valida que la orden
 *   sea del comensal + liquidada (la misma matriz de submit, sin confianza extra).
 *
 * curl -X POST https://admin.rabbitty.me/api/internal/rating \
 *   -H "x-rating-secret: $RATING_INTERNAL_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{"userId":"...","orderId":"...","stars":5,"attributes":["atencion"],"comment":"..."}'
 */

const ATTRS_ALLOWED = new Set(["atencion", "comida", "tiempo", "ambiente"]);
const FAILURE_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NOT_LIQUID: 400,
  WINDOW_CLOSED: 400,
};

export async function POST(req: NextRequest) {
  const expected = process.env.RATING_INTERNAL_SECRET || "";
  const provided = req.headers.get("x-rating-secret") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 });

    const userId = String(body?.userId || "")
    if (!userId) return NextResponse.json({ ok: false, error: "userId requerido" }, { status: 400 });

    const orderId = String(body?.orderId || "");
    const stars = Number(body?.stars);
    if (!orderId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ ok: false, error: "orderId/stars inválidos" }, { status: 400 });
    }
    const attributes = Array.isArray(body?.attributes)
      ? body.attributes.filter((a: unknown) => typeof a === "string" && ATTRS_ALLOWED.has(a as string)).slice(0, 4)
      : null;
    const comment = typeof body?.comment === "string" ? body.comment.slice(0, 500) : null;

    const result = await submitRatingForOrder(getRestaurantDb(), {
      actorUserId: userId,
      orderId,
      stars,
      attributes,
      comment,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.message, code: result.code },
        { status: FAILURE_STATUS[result.code] ?? 400 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    console.error("[INTERNAL_RATING] falló:", err instanceof Error ? err.stack || err.message : err);
    return NextResponse.json({ ok: false, error: "Error interno al registrar evaluación" }, { status: 500 });
  }
}
