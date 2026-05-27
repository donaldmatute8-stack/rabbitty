import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const businesses = await prisma.business.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
    });

    // Transform to FeedItem format expected by the frontend
    const items = businesses.map((b) => {
      // Generate a random distance between 0.1 and 3.5 km for UI realism if GPS isn't used
      const randomDistance = (Math.random() * 3 + 0.1).toFixed(1);

      return {
        id: b.id,
        user: b.name,
        device: b.category,
        time: "Activo ahora",
        distance: parseFloat(randomDistance),
        reward_percentage: b.reward_percentage,
        imageUrl: b.logo_base64,
        lat: b.location_lat,
        lng: b.location_lng,
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("[FEED_ERROR]", error);
    return NextResponse.json({ error: "Error fetching feed" }, { status: 500 });
  }
}
