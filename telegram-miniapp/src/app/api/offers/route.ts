import { NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    // Precios de referencia de producto de entrada por nicho/categoría (MXN)
    // El umbral mínimo requerido para publicar en Stock es el 10% del producto de entrada
    const NICHE_CONFIG: Record<string, { refPrice: number; sampleTitle: string; sampleCost: number }> = {
      'cafetería': { refPrice: 50, sampleTitle: 'Café de Especialidad / Shot de Cortesía', sampleCost: 15 },
      'cafeteria': { refPrice: 50, sampleTitle: 'Café de Especialidad / Shot de Cortesía', sampleCost: 15 },
      'cafe': { refPrice: 50, sampleTitle: 'Café de Especialidad / Shot de Cortesía', sampleCost: 15 },
      'restaurante': { refPrice: 150, sampleTitle: 'Cupón Gastronómico / Entrada', sampleCost: 35 },
      'restaurante & bar': { refPrice: 180, sampleTitle: 'Bebida de la Casa / Snack', sampleCost: 40 },
      'mariscos': { refPrice: 200, sampleTitle: 'Tostada del Día / Entrada de Mar', sampleCost: 45 },
      'retail': { refPrice: 500, sampleTitle: 'Cupón de Descuento en Tienda', sampleCost: 50 },
      'ropa': { refPrice: 1200, sampleTitle: 'Accesorio / Cupón Exclusivo', sampleCost: 120 },
      'estética & barbería': { refPrice: 250, sampleTitle: 'Corte / Arreglo de Barba Express', sampleCost: 50 },
      'barbería': { refPrice: 250, sampleTitle: 'Corte / Arreglo de Barba Express', sampleCost: 50 },
      'estética': { refPrice: 250, sampleTitle: 'Corte / Arreglo de Barba Express', sampleCost: 50 },
      'belleza': { refPrice: 250, sampleTitle: 'Servicio de Belleza / Retoque', sampleCost: 50 },
      'gimnasio': { refPrice: 300, sampleTitle: 'Día de Clase / Visita de Prueba', sampleCost: 60 },
      'fitness': { refPrice: 300, sampleTitle: 'Día de Clase / Visita de Prueba', sampleCost: 60 },
      'spa': { refPrice: 350, sampleTitle: 'Masaje / Ritual de Prueba', sampleCost: 70 },
      'panadería': { refPrice: 40, sampleTitle: 'Pieza de Panería Artesanal', sampleCost: 12 },
      'panaderia': { refPrice: 40, sampleTitle: 'Pieza de Panería Artesanal', sampleCost: 12 },
      'pastelería': { refPrice: 45, sampleTitle: 'Postre / Dulce del Día', sampleCost: 14 },
      'bar': { refPrice: 180, sampleTitle: 'Bebida de la Casa / Snack', sampleCost: 40 },
      'deportes & aventura': { refPrice: 400, sampleTitle: 'Pase / Renta de Equipo', sampleCost: 80 },
    };

    const getThresholdForCategory = (category?: string | null): { minThreshold: number; defaultCost: number; defaultTitle: string } => {
      const cat = (category || '').toLowerCase();
      for (const [key, conf] of Object.entries(NICHE_CONFIG)) {
        if (cat.includes(key)) {
          return {
            minThreshold: Math.round(conf.refPrice * 0.10), // 10% del precio de entrada
            defaultCost: conf.sampleCost,
            defaultTitle: conf.sampleTitle,
          };
        }
      }
      return { minThreshold: 20, defaultCost: 25, defaultTitle: 'Certificado de Regalo en Local' };
    };

    // Consultamos comercios aprobados que acepten Bunz y tengan saldo real en bóveda
    const businesses = await db.query.ownedBusinesses.findMany({
      where: (b, { eq, and, gt }) => and(
        eq(b.status, 'APPROVED'),
        eq(b.acceptsBunz, true),
        gt(b.bunzBalance, 0)
      ),
      orderBy: [desc(ownedBusinesses.bunzBalance)],
      limit: 20,
    });

    // Filtro inteligente por nicho: el negocio solo califica para Stock si su bóveda cubre el umbral del nicho
    const qualifyingBusinesses = businesses.filter((b) => {
      const { minThreshold } = getThresholdForCategory(b.category);
      return (b.bunzBalance || 0) >= minThreshold;
    });

    const offers = qualifyingBusinesses.map((b) => {
      const gallery = (() => { try { return JSON.parse(b.gallery); } catch { return []; } })();
      const { defaultCost, defaultTitle } = getThresholdForCategory(b.category);
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
