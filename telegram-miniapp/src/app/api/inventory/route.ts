import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, reservations, ownedBusinesses } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    const wallet = searchParams.get("wallet");

    let user;
    if (telegramId) {
      user = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
    } else if (wallet) {
      user = await db.query.users.findFirst({ where: eq(users.tonWalletAddress, wallet) });
    }

    if (!user) {
      return NextResponse.json({ success: true, coupons: [], reservations: [] });
    }

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
