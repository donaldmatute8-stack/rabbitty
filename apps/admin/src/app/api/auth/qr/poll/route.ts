import { NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { webSessions, users } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const db = getCoreDb();
    const [session] = await db.select().from(webSessions).where(eq(webSessions.id, sessionId));

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.userId) {
      const [user] = await db.select().from(users).where(eq(users.id, session.userId));
      return NextResponse.json({ 
        success: true, 
        authenticated: true,
        user: {
          id: user?.id,
          telegramId: user?.telegramId,
          username: user?.username
        }
      });
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      return NextResponse.json({ success: true, authenticated: false, expired: true });
    }

    return NextResponse.json({ success: true, authenticated: false });
  } catch (error) {
    console.error("QR Poll Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
