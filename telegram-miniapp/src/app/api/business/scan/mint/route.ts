import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { telegramId, businessId, fiatAmount } = await req.json();

    if (!telegramId || !businessId || !fiatAmount || fiatAmount <= 0) {
      return NextResponse.json({ error: "Faltan parámetros requeridos o monto inválido." }, { status: 400 });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado o no autorizado." }, { status: 403 });
    }

    const customer = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId)
    });

    if (!customer) {
      return NextResponse.json({ error: "El usuario no existe o no está registrado." }, { status: 404 });
    }

    const bunzReward = Math.floor(fiatAmount * (business.rewardPercentage / 100));

    if (bunzReward <= 0) {
      return NextResponse.json({ error: "El monto es muy bajo para generar una recompensa en Bunz." }, { status: 400 });
    }

    // Insert transaction record
    await db.insert(transactions).values({
      userId: customer.id,
      businessId: business.id,
      fiatAmount,
      bunzMinted: bunzReward,
      status: "MINTED",
    });

    // Update customer balance
    await db.update(users)
      .set({ totalBunzEarned: (customer.totalBunzEarned ?? 0) + bunzReward })
      .where(eq(users.id, customer.id));

    return NextResponse.json({
      success: true,
      message: "Recompensa otorgada exitosamente.",
      bunzRewarded: bunzReward
    });

  } catch (error: any) {
    console.error("[MINT_ERROR]", error);
    return NextResponse.json({ error: error.message || "Error procesando la recompensa" }, { status: 500 });
  }
}
