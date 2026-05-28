import { NextResponse } from "next/server";
import { db } from "@/db";
import { qrSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [session] = await db.select().from(qrSessions).where(eq(qrSessions.id, sessionId));

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "PENDING" || new Date() > session.expiresAt!) {
      return NextResponse.json({ error: "Session expired or already processed" }, { status: 400 });
    }

    await db.update(qrSessions)
      .set({ status: "APPROVED", userId })
      .where(eq(qrSessions.id, sessionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving QR session:", error);
    return NextResponse.json({ error: "Failed to approve session" }, { status: 500 });
  }
}
