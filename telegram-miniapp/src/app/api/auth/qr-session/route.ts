import { NextResponse } from "next/server";
import { db } from "@/db";
import { qrSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const [session] = await db.insert(qrSessions).values({
      token: crypto.randomUUID(),
      status: "PENDING",
      expiresAt,
    }).returning();

    return NextResponse.json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error("Error creating QR session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const [session] = await db.select().from(qrSessions).where(eq(qrSessions.id, sessionId));

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (new Date() > session.expiresAt!) {
      await db.update(qrSessions).set({ status: "EXPIRED" }).where(eq(qrSessions.id, sessionId));
      return NextResponse.json({ status: "EXPIRED" });
    }

    return NextResponse.json({ status: session.status, userId: session.userId });
  } catch (error) {
    console.error("Error fetching QR session:", error);
    return NextResponse.json({ error: "Failed to fetch session status" }, { status: 500 });
  }
}
