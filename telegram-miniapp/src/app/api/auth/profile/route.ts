import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals, webSessions, ownedBusinesses } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    // Solo se puede consultar el perfil propio, autenticado con session token.
    // No se acepta telegramId/userId/wallet por query (evita IDOR).
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-session-token");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.query.webSessions.findFirst({
      where: and(
        eq(webSessions.jwtToken, token),
        gt(webSessions.expiresAt, new Date())
      ),
    });

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      with: { level: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate pending referral bunz
    let pendingBunz = 0;
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
    }).from(referrals)
      .where(and(eq(referrals.inviterId, profile.id), eq(referrals.status, "PENDING")));
    pendingBunz = result[0]?.total ?? 0;

    const ownedBusiness = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.ownerId, profile.id),
    });

    return NextResponse.json({ profile: { ...profile, pendingBunz, ownedBusiness } }, { status: 200 });
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-session-token");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.query.webSessions.findFirst({
      where: and(
        eq(webSessions.jwtToken, token),
        gt(webSessions.expiresAt, new Date())
      ),
    });

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { username, firstName, lastName, supportWhatsApp, phoneNumber } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) updateData.firstName = String(firstName).trim();
    if (lastName !== undefined) updateData.lastName = String(lastName).trim();
    if (supportWhatsApp !== undefined) updateData.supportWhatsApp = String(supportWhatsApp).trim();
    if (phoneNumber !== undefined) updateData.phoneNumber = String(phoneNumber).trim();

    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase().replace(/^@/, '');
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: "El nombre de usuario debe tener al menos 3 caracteres" }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        return NextResponse.json({ error: "Solo se permiten letras, números y guiones bajos" }, { status: 400 });
      }

      // Check uniqueness across other users
      const existing = await db.query.users.findFirst({
        where: eq(users.username, cleanUsername),
      });

      if (existing && existing.id !== session.userId) {
        return NextResponse.json({ error: "Este nombre de usuario ya está en uso" }, { status: 409 });
      }

      updateData.username = cleanUsername;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.userId))
      .returning();

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("[PATCH_PROFILE]", error);
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}
