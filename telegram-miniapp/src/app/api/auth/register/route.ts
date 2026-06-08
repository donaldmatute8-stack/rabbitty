import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, firstName, lastName, username, tonWalletAddress } = body;

    if (!telegramId) {
      return NextResponse.json({ error: "Missing telegramId" }, { status: 400 });
    }

    const [user] = await db.insert(users).values({
      telegramId,
      firstName,
      lastName,
      username,
      tonWalletAddress,
    }).onConflictDoUpdate({
      target: users.telegramId,
      set: {
        firstName,
        lastName,
        username,
        tonWalletAddress,
        updatedAt: new Date(),
      }
    }).returning();

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("[REGISTER_USER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
