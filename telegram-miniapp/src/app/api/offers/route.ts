import { NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    // La lógica de nicho vive en `lib/syntheticOffers` para que el
    // descubrimiento Bunz y esta ruta no se contradigan.
    const { thresholdForCategory } = await import('@/lib/syntheticOffers');

    // Consultamos comercios aprobados que acepten Bunz y tengan saldo real en bóveda
    const businesses = await db.query.ownedBusinesses.findMany({
      where: (b, { eq, and, gt }) => and(
        eq(b.status, 'APPROVED'),
        eq(b.acceptsBunz, true),
        eq(b.sandbox, false),
        gt(b.bunzBalance, 0)
      ),
      orderBy: [desc(ownedBusinesses.bunzBalance)],
      limit: 20,
    });

    // Filtro inteligente por nicho: el negocio solo califica para Stock si su bóveda cubre el umbral del nicho
    const qualifyingBusinesses = businesses.filter((b) => {
      const { minThreshold } = thresholdForCategory(b.category);
      return (b.bunzBalance || 0) >= minThreshold;
    });

    const offers = qualifyingBusinesses.map((b) => {
      const gallery = (() => { try { return JSON.parse(b.gallery); } catch { return []; } })();
      const { defaultCost, defaultTitle } = thresholdForCategory(b.category);
      const computedCost = Math.max(defaultCost, Math.round(b.rewardPercentage * 2));

      return {
        id: b.id,
        title: `${defaultTitle} - ${b.name}`,
        description: `Canjea este beneficio exclusivo pagando con tus Bunz acumulados en ${b.name}.`,
        bunzCost: computedCost,
        businessName: b.name,
        businessLogo: gallery[0] || b.logoUrl || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=150&q=80",
        limit: Math.floor((b.bunzBalance || 0) / Math.max(1, computedCost)) || 10,
        isAvailable: true,
        image: gallery[0] || b.logoUrl || "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80",
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
