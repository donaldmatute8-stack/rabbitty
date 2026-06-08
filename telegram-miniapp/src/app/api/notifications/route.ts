import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId") || searchParams.get("userId");

    if (!telegramId) {
      return NextResponse.json({ success: true, notifications: [] });
    }

    const user = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
    if (!user) {
      return NextResponse.json({ success: true, notifications: [] });
    }

    const rows = await db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ success: true, notifications: rows });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return NextResponse.json({ success: true, notifications: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, title, message, type } = body;

    if (!userId || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [notification] = await db.insert(notifications).values({
      userId,
      title,
      message,
      type: type || "SYSTEM",
    }).returning();

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("[NOTIFICATIONS_POST]", error);
    return NextResponse.json({ error: "Error creating notification" }, { status: 500 });
  }
}
