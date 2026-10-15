import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = caller;

    const userReservations = await db.query.reservations.findMany({
      where: eq(reservations.userId, user.id),
      with: { business: true },
    });

    const mappedReservations = userReservations.map((r) => ({
      id: r.id,
      business: { name: r.business.name },
      reserved_bunz: r.bunzCost,
      expires_at: r.date?.toISOString() ?? new Date().toISOString(),
      status: r.status,
    }));

    return NextResponse.json({
      success: true,
      coupons: [],
      reservations: mappedReservations,
    });
  } catch (error) {
    console.error("Inventory API Error:", error);
    return NextResponse.json({ error: "Error al obtener inventario" }, { status: 500 });
  }
}
