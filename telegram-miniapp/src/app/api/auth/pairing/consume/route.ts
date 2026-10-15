import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses, webSessions } from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, sid } = body;

    if (!token || !sid) {
      return NextResponse.json({ error: "Faltan parámetros de vinculación (token o sid)" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Consumo atómico: eliminar de inmediato el token efímero para prevenir race conditions
    const [consumedSession] = await db
      .delete(webSessions)
      .where(
        and(
          eq(webSessions.id, sid),
          eq(webSessions.jwtToken, tokenHash),
          gt(webSessions.expiresAt, new Date())
        )
      )
      .returning();

    if (!consumedSession || !consumedSession.userId) {
      return NextResponse.json({ error: "El código o enlace de vinculación es inválido o ya ha sido utilizado" }, { status: 401 });
    }

    // Obtener información del usuario dueño
    const user = await db.query.users.findFirst({
      where: eq(users.id, consumedSession.userId),
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar si tiene negocio asociado
    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.ownerId, user.id),
    });

    // Generar sesión persistente de 30 días para el scanner del móvil
    // Se almacena en DB el hash SHA-256 o token seguro y se entrega el raw session token al cliente
    const permanentSessionToken = crypto.randomBytes(32).toString("hex");
    const permanentTokenHash = crypto.createHash("sha256").update(permanentSessionToken).digest("hex");
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Compatibilidad segura con webSessions: insertamos el raw token para que los endpoints existentes funcionen
    // mientras mantenemos atómico el consumo de pairing
    await db.insert(webSessions).values({
      id: crypto.randomUUID(),
      jwtToken: permanentSessionToken,
      userId: user.id,
      expiresAt: thirtyDaysFromNow,
    });

    return NextResponse.json({
      success: true,
      sessionToken: permanentSessionToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            rewardPercentage: business.rewardPercentage,
            status: business.status,
          }
        : null,
    });
  } catch (error) {
    console.error("[PAIRING CONSUME ERROR]", error);
    return NextResponse.json({ error: "Error interno al verificar la vinculación" }, { status: 500 });
  }
}
