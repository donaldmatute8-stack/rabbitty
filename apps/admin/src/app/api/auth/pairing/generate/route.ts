import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { users, ownedBusinesses, webSessions } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const db = getCoreDb();
    const userSessionId = session.user.id;

    // Localizar usuario en la BD
    let [dbUser] = await db.select().from(users).where(eq(users.id, userSessionId));

    if (!dbUser && session.user.email) {
      const [byEmail] = await db.select().from(users).where(eq(users.email, session.user.email));
      dbUser = byEmail;
    }

    if (!dbUser && session.user.email?.endsWith("@telegram.rabbitty")) {
      const tgId = session.user.email.replace("@telegram.rabbitty", "");
      const [byTg] = await db.select().from(users).where(eq(users.telegramId, tgId));
      dbUser = byTg;
    }

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario de administración no encontrado" }, { status: 404 });
    }

    // Buscar negocio asociado
    const [business] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.ownerId, dbUser.id));

    // Generar token seguro para emparejamiento
    const pairingToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(pairingToken).digest("hex");

    // Crear sesión de vinculación en webSessions válida por 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const [webSession] = await db
      .insert(webSessions)
      .values({
        id: crypto.randomUUID(),
        jwtToken: tokenHash,
        userId: dbUser.id,
        expiresAt,
      })
      .returning();

    // Determinar la URL del scanner móvil
    // En desarrollo: http://localhost:3001, en producción: https://app.rabbitty.me
    const isDev = process.env.NODE_ENV !== "production";
    const mobileBase = isDev ? "http://localhost:3001" : "https://app.rabbitty.me";
    const pairingUrl = `${mobileBase}/magic-link?token=${pairingToken}&sid=${webSession.id}`;

    return NextResponse.json({
      success: true,
      pairingUrl,
      pairingToken,
      sessionId: webSession.id,
      expiresAt: expiresAt.toISOString(),
      businessName: business?.name || "Rabbitty Comercio",
    });
  } catch (error) {
    console.error("[PAIRING GENERATE ERROR]", error);
    return NextResponse.json({ error: "Error interno al generar código de vinculación" }, { status: 500 });
  }
}
