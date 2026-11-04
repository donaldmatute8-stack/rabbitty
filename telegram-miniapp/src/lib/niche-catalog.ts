/**
 * ── Catálogo de nichos (contexto compartido) ──
 *
 * Fuente única para: el email de solicitud, la captura del onboarding y el
 * prompt de Bunzy. Incluye nichos ACTIVOS (cubiertos hoy) y nichos conocidos
 * pero aún NO disponibles, para que Bunzy tenga contexto de cada giro aunque
 * todavía no lo operemos.
 *
 * Este archivo es deliberadamente estático: no toca la base ni datos de ningún
 * tenant, así que se puede usar en cualquier prompt sin riesgo de fuga.
 */

export interface NicheContext {
  label: string;
  /** Disponible hoy en Rabbitty. */
  available: boolean;
  /** Qué resuelve (o resolverá) para ese giro. */
  promise: string;
}

export const NICHE_CONTEXT: Record<string, NicheContext> = {
  restaurant: {
    label: 'Restaurante',
    available: true,
    promise: 'mesas y cuentas por comensal, cocina/KDS, menú con modificadores, reservas, propinas, inventario y recetas',
  },
  cafe: {
    label: 'Cafetería',
    available: true,
    promise: 'barra rápida, pedidos para llevar, lealtad por visita e inventario de insumos',
  },
  bar: {
    label: 'Bar',
    available: true,
    promise: 'cuentas abiertas, happy hour, control de barra, propinas y mesas',
  },
  bakery: {
    label: 'Panadería / Postres',
    available: true,
    promise: 'venta por pieza o charola, sin mesas, cobro rápido e inventario',
  },
  pizza: {
    label: 'Pizzería',
    available: true,
    promise: 'pedidos para recoger y a domicilio, menú con tamaños y extras, cocina e inventario',
  },
  tacos: {
    label: 'Taquería / Antojitos',
    available: true,
    promise: 'alta rotación, pedidos al momento, mesas opcionales y propinas',
  },
  barbershop: {
    label: 'Barbería / Estética',
    available: true,
    promise: 'citas por colaborador, servicios con duración, comisiones y propinas',
  },
  fitness: {
    label: 'Gym / Fitness',
    available: true,
    promise: 'membresías, clases, control de accesos y cobros recurrentes',
  },
  retail: {
    label: 'Tienda / Retail',
    available: true,
    promise: 'inventario, código de barras, caja rápida y promociones',
  },
  services: {
    label: 'Servicios / Citas',
    available: true,
    promise: 'agenda, anticipos, recordatorios y comisiones por colaborador',
  },
  veterinary: {
    label: 'Veterinaria',
    available: false,
    promise: 'expediente por mascota, citas, vacunas, inventario de medicamentos y cobros recurrentes',
  },
  pharmacy: {
    label: 'Farmacia',
    available: false,
    promise: 'venta por código de barras, inventario con caducidades, recetas y control de lotes',
  },
  laundry: {
    label: 'Lavandería',
    available: false,
    promise: 'órdenes por ticket, cobro por kilo o pieza, entrega y recolección',
  },
  hotel: {
    label: 'Hotel / Hospedaje',
    available: false,
    promise: 'habitaciones, reservas, check-in/out y cargos a la cuenta',
  },
  florist: {
    label: 'Florería',
    available: false,
    promise: 'catálogo de arreglos, pedidos personalizados, fechas de entrega y domicilio',
  },
  hardware: {
    label: 'Ferretería',
    available: false,
    promise: 'inventario por medida/unidad, cotizaciones, crédito a clientes y código de barras',
  },
  stationery: {
    label: 'Papelería',
    available: false,
    promise: 'inventario, copias e impresión, temporada escolar y venta por pieza',
  },
  automotive: {
    label: 'Taller mecánico',
    available: false,
    promise: 'órdenes de trabajo, cotizaciones, refacciones y citas por vehículo',
  },
  pet_grooming: {
    label: 'Estética canina',
    available: false,
    promise: 'citas por mascota, paquetes de servicio y recordatorios recurrentes',
  },
  coworking: {
    label: 'Coworking / Oficinas',
    available: false,
    promise: 'planes y membresías, reserva de salas y control de accesos',
  },
};

export function nicheContext(id?: string | null): NicheContext | null {
  if (!id) return null;
  return NICHE_CONTEXT[id] ?? null;
}

/** Texto determinista para el prompt de Bunzy: contexto de TODOS los giros. */
export function buildNicheCatalogPrompt(): string {
  const lines = Object.entries(NICHE_CONTEXT).map(
    ([id, n]) => `- ${n.label} (${id}) · ${n.available ? 'DISPONIBLE' : 'AÚN NO DISPONIBLE'}: ${n.promise}.`,
  );
  return `CATÁLOGO DE NICHOS Y SU CONTEXTO (no inventes otros):
${lines.join('\n')}
Si el giro no aparece en esta lista, trátalo como NO disponible y ofrece registrar la solicitud.`;
}
