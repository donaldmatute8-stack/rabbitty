import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const offers = await prisma.offer.findMany({
      where: { is_active: true },
      include: {
        business: true,
      },
      orderBy: { created_at: "desc" },
    });

    const formattedOffers = offers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      description: offer.description,
      bunzCost: offer.bunz_price,
      businessName: offer.business?.name || "Negocio",
      businessLogo: offer.business?.logo_base64 || "",
      limit: offer.daily_quantity,
      isAvailable: offer.daily_quantity > 0,
      image: offer.image_base64,
    }));

    return NextResponse.json({ success: true, offers: formattedOffers });
  } catch (error: any) {
    console.error("[OFFERS_ERROR]", error);
    return NextResponse.json({ error: "Error fetching offers" }, { status: 500 });
  }
}
