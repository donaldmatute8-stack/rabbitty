import { NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { webSessions } from "@rabbitty/database-core";
import crypto from "crypto";

export async function POST() {
  try {
    const qrToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(qrToken).digest("hex");
    const db = getCoreDb();

    const [session] = await db.insert(webSessions).values({
      id: crypto.randomUUID(),
      jwtToken: tokenHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }).returning();

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      qrToken: qrToken,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error("QR Generate Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
