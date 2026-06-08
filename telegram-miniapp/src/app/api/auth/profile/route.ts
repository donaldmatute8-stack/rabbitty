import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    const wallet = searchParams.get("wallet"); // kept for backwards compatibility if needed

    if (!telegramId && !wallet) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    let profile = null;
    
    if (telegramId) {
      profile = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId),
      });
    } else if (wallet) {
      profile = await db.query.users.findFirst({
        where: eq(users.tonWalletAddress, wallet),
      });
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
