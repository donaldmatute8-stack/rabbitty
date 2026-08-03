import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses } from "@/db/schema";
import { ilike, or, eq, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const businesses = await db
      .select({
        id: ownedBusinesses.id,
        name: ownedBusinesses.name,
        category: ownedBusinesses.category,
        logoUrl: ownedBusinesses.logoUrl,
        rewardPercentage: ownedBusinesses.rewardPercentage,
      })
      .from(ownedBusinesses)
      .where(
        and(
          eq(ownedBusinesses.status, 'APPROVED'),
          query
            ? or(
                ilike(ownedBusinesses.name, `%${query}%`),
                ilike(ownedBusinesses.category, `%${query}%`)
              )
            : undefined
        )
      )
      .limit(10);

    return NextResponse.json({ success: true, businesses });
  } catch (error) {
    console.error("Error searching businesses:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
