import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  try {
    const { telegramId, role } = await req.json();

    if (!telegramId || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (role !== "USER" && role !== "AFFILIATE" && role !== "ADMIN") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.telegramId, telegramId))
      .returning();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("[SET_ROLE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
