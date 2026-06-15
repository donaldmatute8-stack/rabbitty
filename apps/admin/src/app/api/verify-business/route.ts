import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { users, ownedBusinesses } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getCoreDb();

    // Verify user role is ADMIN in database
    const [dbUser] = await db.select().from(users).where(eq(users.id, session.user.id));

    if (!dbUser || dbUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get restaurantId from POST body
    const body = await request.json();
    const { restaurantId } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    }

    // Check if business exists
    const [business] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, restaurantId));

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Perform verification update in database (No auto-approving static mock response)
    const verificationNotes = "Google Business verification enabled via Admin dashboard approval";
    await db.update(ownedBusinesses)
      .set({
        status: "VERIFIED",
        verificationMethod: "admin_approve",
        verificationData: JSON.stringify({
          verifiedAt: new Date().toISOString(),
          approvedBy: session.user.id,
          notes: verificationNotes,
        }),
        updatedAt: new Date(),
      })
      .where(eq(ownedBusinesses.id, restaurantId));

    return NextResponse.json({
      success: true,
      message: "Business successfully verified in database",
      data: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verificationMethod: "admin_approve",
        verificationNotes,
      },
    });
  } catch (error) {
    console.error("Business Verification Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
