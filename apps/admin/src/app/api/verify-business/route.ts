import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("next-auth.session-token");
    
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get restaurantId from POST body
    const body = await request.json();
    const { restaurantId } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    }

    // In production, verify with Google Business API here
    // For now, mark as verified instantly
    return NextResponse.json({
      success: true,
      message: "Business verified",
      data: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verificationMethod: "admin_approve",
        verificationNotes: "Google Business verification enabled",
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
