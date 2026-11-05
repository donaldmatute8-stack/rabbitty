import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Catálogo de nichos para el onboarding web.
 * Sale de la tabla `niches` (activos) y cae a una lista mínima si la DB no está.
 */

const FALLBACK = [
  { id: 'restaurant', name: 'Restaurante', description: 'Mesas, cocina y cuentas por comensal.' },
  { id: 'cafe', name: 'Cafetería', description: 'Barra rápida, para llevar y lealtad.' },
  { id: 'bar', name: 'Bar', description: 'Cuentas abiertas, happy hour y barra.' },
  { id: 'bakery', name: 'Panadería / Postres', description: 'Venta por pieza o charola.' },
  { id: 'pizza', name: 'Pizzería', description: 'Pedidos para recoger y a domicilio.' },
  { id: 'tacos', name: 'Taquería / Antojitos', description: 'Alta rotación y pedidos al momento.' },
  { id: 'barbershop', name: 'Barbería / Estética', description: 'Citas por colaborador y comisiones.' },
  { id: 'fitness', name: 'Gym / Fitness', description: 'Membresías, clases y accesos.' },
  { id: 'retail', name: 'Tienda / Retail', description: 'Inventario, código de barras y caja.' },
  { id: 'services', name: 'Servicios / Citas', description: 'Agenda, anticipos y recordatorios.' },
];

export async function GET() {
  const url = process.env.CORE_DATABASE_URL;
  if (url) {
    try {
      const postgres = (await import('postgres')).default;
      const sql = postgres(url, { ssl: 'require', max: 1 });
      const rows = await sql`
        SELECT id, name, icon, description
        FROM "niches"
        WHERE "isActive" = true
        ORDER BY "order" ASC
      `;
      await sql.end();
      if (rows.length > 0) {
        return NextResponse.json({ success: true, niches: rows });
      }
    } catch (error) {
      console.error('[LANDING NICHES]', error);
    }
  }

  return NextResponse.json({ success: true, niches: FALLBACK });
}
