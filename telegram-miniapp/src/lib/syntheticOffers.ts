/**
 * ── Oferta sintética por nicho (temporal) ──────────────────────────────────
 *
 * Mientras no exista `business_offers` (fase Stock), la app necesita una oferta
 * de referencia por negocio para poder mostrar "desde X Bunz" y la
 * disponibilidad real (`bunzBalance`). Vive en un solo lugar para que
 * `/api/offers` y `/api/bunz/discover` no se contradigan.
 *
 * Cuando entre la tabla real, este archivo se borra y el `spend` sale del
 * servidor de ofertas.
 */

export interface NicheConfig {
  refPrice: number;
  sampleTitle: string;
  sampleCost: number;
}

export const NICHE_CONFIG: Record<string, NicheConfig> = {
  'cafetería': { refPrice: 50, sampleTitle: 'Café de Especialidad / Shot de Cortesía', sampleCost: 15 },
  cafeteria: { refPrice: 50, sampleTitle: 'Café de Especialidad / Shot de Cortesía', sampleCost: 15 },
  cafe: { refPrice: 50, sampleTitle: 'Café de Especialidad / Shot de Cortesía', sampleCost: 15 },
  restaurante: { refPrice: 150, sampleTitle: 'Cupón Gastronómico / Entrada', sampleCost: 35 },
  'restaurante & bar': { refPrice: 180, sampleTitle: 'Bebida de la Casa / Snack', sampleCost: 40 },
  mariscos: { refPrice: 200, sampleTitle: 'Tostada del Día / Entrada de Mar', sampleCost: 45 },
  retail: { refPrice: 500, sampleTitle: 'Cupón de Descuento en Tienda', sampleCost: 50 },
  ropa: { refPrice: 1200, sampleTitle: 'Accesorio / Cupón Exclusivo', sampleCost: 120 },
  'estética & barbería': { refPrice: 250, sampleTitle: 'Corte / Arreglo de Barba Express', sampleCost: 50 },
  barbería: { refPrice: 250, sampleTitle: 'Corte / Arreglo de Barba Express', sampleCost: 50 },
  estética: { refPrice: 250, sampleTitle: 'Corte / Arreglo de Barba Express', sampleCost: 50 },
  belleza: { refPrice: 250, sampleTitle: 'Servicio de Belleza / Retoque', sampleCost: 50 },
  gimnasio: { refPrice: 300, sampleTitle: 'Día de Clase / Visita de Prueba', sampleCost: 60 },
  fitness: { refPrice: 300, sampleTitle: 'Día de Clase / Visita de Prueba', sampleCost: 60 },
  spa: { refPrice: 350, sampleTitle: 'Masaje / Ritual de Prueba', sampleCost: 70 },
  panadería: { refPrice: 40, sampleTitle: 'Pieza de Panería Artesanal', sampleCost: 12 },
  panaderia: { refPrice: 40, sampleTitle: 'Pieza de Panería Artesanal', sampleCost: 12 },
  pastelería: { refPrice: 45, sampleTitle: 'Postre / Dulce del Día', sampleCost: 14 },
  bar: { refPrice: 180, sampleTitle: 'Bebida de la Casa / Snack', sampleCost: 40 },
  'deportes & aventura': { refPrice: 400, sampleTitle: 'Pase / Renta de Equipo', sampleCost: 80 },
};

export function thresholdForCategory(category?: string | null): {
  minThreshold: number;
  defaultCost: number;
  defaultTitle: string;
} {
  const cat = (category || '').toLowerCase();
  for (const [key, conf] of Object.entries(NICHE_CONFIG)) {
    if (cat.includes(key)) {
      return {
        minThreshold: Math.round(conf.refPrice * 0.1),
        defaultCost: conf.sampleCost,
        defaultTitle: conf.sampleTitle,
      };
    }
  }
  return { minThreshold: 20, defaultCost: 25, defaultTitle: 'Certificado de Regalo en Local' };
}

/** Oferta de referencia de un negocio, o null si no califica por umbral. */
export function syntheticOfferFor(business: {
  category?: string | null;
  bunzBalance?: number | null;
  rewardPercentage?: number | null;
}): { title: string; bunzCost: number; canjesDisponibles: number; minThreshold: number } | null {
  const { minThreshold, defaultCost, defaultTitle } = thresholdForCategory(business.category);
  const balance = Number(business.bunzBalance || 0);
  if (balance < minThreshold) return null;

  const cost = Math.max(defaultCost, Math.round(Number(business.rewardPercentage || 0) * 2));
  const canjes = Math.floor(balance / Math.max(1, cost));
  if (canjes < 1) return null;

  return { title: defaultTitle, bunzCost: cost, canjesDisponibles: canjes, minThreshold };
}
