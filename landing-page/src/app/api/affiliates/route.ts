import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.CORE_DATABASE_URL || process.env.POSTGRES_URL;

  if (!dbUrl) {
    // Fallback inicial con los locales piloto si no hay conexión directa en runtime
    return NextResponse.json({
      success: true,
      businesses: [
        {
          id: '626cafe',
          name: '626 Café',
          category: 'Cafetería de Especialidad',
          rewardPercentage: 25,
          address: 'Calle Libertad 626, Centro',
          refCode: '626cafe',
        },
      ],
    });
  }

  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

    const rows = await sql`
      SELECT 
        id, 
        name, 
        category, 
        "rewardPercentage", 
        address,
        "logoUrl",
        gallery,
        COALESCE(slug, SUBSTRING(id::text, 1, 8)) as "refCode"
      FROM "ownedBusinesses"
      WHERE status = 'APPROVED' OR status = 'ACTIVE' OR status = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;

    interface DbBusinessRow {
      id: string;
      name: string;
      category: string | null;
      rewardPercentage: number | null;
      address: string | null;
      logoUrl: string | null;
      gallery: string | null;
      refCode: string | null;
    }

    const parseFirstGalleryImage = (str: string | null): string | null => {
      if (!str) return null;
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
      } catch {
        return null;
      }
    };

    const businesses = (rows as unknown as DbBusinessRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category || 'Local Afiliado',
      rewardPercentage: r.rewardPercentage || 25,
      address: r.address || '',
      logoUrl: r.logoUrl || parseFirstGalleryImage(r.gallery) || null,
      refCode: r.refCode || r.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }));

    // Asegurar que 626 Café siempre esté disponible en el dropdown
    if (!businesses.some((b) => b.name.toLowerCase().includes('626'))) {
      businesses.unshift({
        id: '626cafe',
        name: '626 Café',
        category: 'Cafetería de Especialidad',
        rewardPercentage: 25,
        address: 'Calle Libertad 626, Centro',
        logoUrl: null,
        refCode: '626cafe',
      });
    }

    return NextResponse.json({ success: true, businesses });
  } catch (err) {
    console.error('Error fetching businesses for impresos:', err);
    return NextResponse.json({
      success: true,
      businesses: [
        {
          id: '626cafe',
          name: '626 Café',
          category: 'Cafetería de Especialidad',
          rewardPercentage: 25,
          address: 'Calle Libertad 626, Centro',
          refCode: '626cafe',
        },
      ],
    });
  }
}
