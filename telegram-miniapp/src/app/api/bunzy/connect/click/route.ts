import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bunzyBroadcasts, bunzyDeliveries } from "@/db/schema";

export const runtime = "nodejs";

/**
 * ── Bunzy Connect · CTA con tracking ──
 * El CTA de la tarjeta apunta aquí con el id del delivery. Marcamos clickedAt
 * y redirigimos a la URL original del broadcast. Público: el id es aleatorio.
 */
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("d") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Enlace inválido" }, { status: 400 });
  }

  const [row] = await db
    .select({
      deliveryId: bunzyDeliveries.id,
      ctaUrl: bunzyBroadcasts.ctaUrl,
    })
    .from(bunzyDeliveries)
    .innerJoin(bunzyBroadcasts, eq(bunzyDeliveries.broadcastId, bunzyBroadcasts.id))
    .where(eq(bunzyDeliveries.id, id))
    .limit(1);

  if (!row?.ctaUrl) {
    return NextResponse.json({ error: "Enlace no encontrado" }, { status: 404 });
  }

  await db
    .update(bunzyDeliveries)
    .set({ clickedAt: new Date(), updatedAt: new Date() })
    .where(eq(bunzyDeliveries.id, id))
    .catch(() => undefined);

  return NextResponse.redirect(row.ctaUrl);
}
