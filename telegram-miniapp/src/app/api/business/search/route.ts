import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    // Search active businesses by name or category
    const businesses = await prisma.business.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        category: true,
        logo_base64: true,
        reward_percentage: true
      },
      take: 10
    });

    return NextResponse.json({ success: true, businesses });
  } catch (error: any) {
    console.error("Error searching businesses:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
