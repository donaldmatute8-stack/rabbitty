import { NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const businesses = await db.query.ownedBusinesses.findMany({
      where: (b, { eq, and, gt }) => and(eq(b.givesBunz, true), gt(b.rewardPercentage, 0)),
      orderBy: [desc(ownedBusinesses.rewardPercentage)],
      limit: 10,
    });

    const offers = businesses.map((b, i) => {
      const gallery = (() => { try { return JSON.parse(b.gallery); } catch { return []; } })();
      return {
        id: b.id,
        title: `${b.rewardPercentage}% Bunz en ${b.name}`,
        description: `Gana ${b.rewardPercentage}% de tu consumo en Bunz al visitar ${b.name}. Válido en horario de Happy Hour.`,
        bunzCost: Math.max(10, b.rewardPercentage * 2),
        businessName: b.name,
        businessLogo: gallery[0] || b.logoUrl || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=150&q=80",
        limit: 50,
        isAvailable: b.status === "VERIFIED" || b.status === "ACTIVE",
        image: gallery[0] || "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80",
      };
    });

    if (offers.length === 0) {
      return NextResponse.json({
        success: true,
        offers: [{
          id: "default",
          title: "¡Próximamente más ofertas!",
          description: "Nuevos negocios se están uniendo a Rabbitty. Vuelve pronto.",
          bunzCost: 0,
          businessName: "Rabbitty",
          businessLogo: "",
          limit: 0,
          isAvailable: false,
          image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
        }],
      });
    }

    return NextResponse.json({ success: true, offers });
  } catch (error: any) {
    console.error("[OFFERS_ERROR]", error);
    return NextResponse.json({ error: "Error al obtener ofertas" }, { status: 500 });
  }
}
