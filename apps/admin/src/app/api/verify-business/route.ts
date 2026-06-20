import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { users, ownedBusinesses, webSessions } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.AUTH_TELEGRAM_BOT_TOKEN;
const ADMIN_URL = process.env.NEXT_PUBLIC_APP_URL || "https://admin.rabbitty.me";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getCoreDb();

    const [dbUser] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!dbUser || dbUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { restaurantId } = body;
    if (!restaurantId) {
      return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    }

    const [business] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, restaurantId));
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Approve business and generate magic link for owner
    const qrToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(qrToken).digest("hex");

    await db.update(ownedBusinesses)
      .set({
        status: "VERIFIED",
        verificationMethod: "admin_approve",
        verificationData: JSON.stringify({
          verifiedAt: new Date().toISOString(),
          approvedBy: session.user.id,
          magicToken: tokenHash,
        }),
        updatedAt: new Date(),
      })
      .where(eq(ownedBusinesses.id, restaurantId));

    // Create web session for magic link
    const [webSession] = await db.insert(webSessions).values({
      jwtToken: tokenHash,
      userId: business.ownerId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning();

    const magicUrl = `${ADMIN_URL}/magic?token=${qrToken}&sid=${webSession.id}`;

    // Send Telegram notification to business owner
    if (TELEGRAM_BOT_TOKEN) {
      const [owner] = await db.select().from(users).where(eq(users.id, business.ownerId));
      if (owner?.telegramId) {
        const message =
          `🎉 *¡Felicidades! Tu negocio ${business.name} ha sido aprobado.*\n\n` +
          `Ya estás listo para operar en Rabbitty. Tus clientes pueden escanear y ganar Bunz.\n\n` +
          `🔗 *Panel de Administración:*\n${ADMIN_URL}\n\n` +
          `🔑 *Tu enlace mágico (un solo clic):*\n${magicUrl}\n\n` +
          `Este enlace te conecta automáticamente. No lo compartas.\n\n` +
          `🐰 — Rabbitty Team`;

        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: owner.telegramId, text: message, parse_mode: "Markdown", disable_web_page_preview: true }),
          });
        } catch (e) {
          console.error("Failed to send approval notification:", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Business approved and owner notified via Telegram",
      data: { verified: true, verifiedAt: new Date().toISOString(), magicUrl },
    });
  } catch (error) {
    console.error("Business Verification Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
