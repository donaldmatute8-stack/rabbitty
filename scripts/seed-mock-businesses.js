const postgres = require('postgres');

const url = 'postgresql://neondb_owner:npg_VIiF4NGd0OMp@ep-delicate-violet-ap6izh0k-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const client = postgres(url, { ssl: 'require' });

const mockOwnerId = 'cd10b94f-711b-4ada-b707-1cda7cb8c46f';

const businesses = [
  {
    ownerId: mockOwnerId,
    name: 'Kukaramakara',
    category: 'Restaurante & Bar',
    description: 'Restaurante bar con la mejor comida de Bahía de Banderas. Música en vivo todos los fines de semana.',
    address: 'Nuevo Vallarta, Bahía de Banderas, Nayarit',
    lat: 20.737024,
    lng: -105.274895,
    rewardPercentage: 10,
    rarity: 'epic',
    givesBunz: true,
    acceptsBunz: true,
    gallery: JSON.stringify(['https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?auto=format&fit=crop&w=800&q=80']),
    logoUrl: '',
    status: 'APPROVED',
    creditLimit: 10000,
  },
  {
    ownerId: mockOwnerId,
    name: '626 Café',
    category: 'Cafés',
    description: 'El mejor café y desayunos de Bucerías. Ambiente relajado y pet-friendly.',
    address: 'Bucerías, Bahía de Banderas, Nayarit',
    lat: 20.753317,
    lng: -105.335294,
    rewardPercentage: 15,
    rarity: 'rare',
    givesBunz: true,
    acceptsBunz: false,
    gallery: JSON.stringify(['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80']),
    logoUrl: '',
    status: 'APPROVED',
    creditLimit: 8000,
  },
  {
    ownerId: mockOwnerId,
    name: 'La Palapa del Mar',
    category: 'Mariscos',
    description: 'Mariscos frescos frente al mar. Ceviche, aguachiles y más.',
    address: 'Sayulita, Nayarit',
    lat: 20.868,
    lng: -105.451,
    rewardPercentage: 12,
    rarity: 'rare',
    givesBunz: true,
    acceptsBunz: false,
    gallery: JSON.stringify(['https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80']),
    logoUrl: '',
    status: 'APPROVED',
    creditLimit: 6000,
  },
  {
    ownerId: mockOwnerId,
    name: 'Studio Ink',
    category: 'Arte & Tatuajes',
    description: 'Estudio de tatuajes y arte corporal. Diseños únicos y personalizados.',
    address: 'Bucerías, Bahía de Banderas, Nayarit',
    lat: 20.754,
    lng: -105.337,
    rewardPercentage: 8,
    rarity: 'legendary',
    givesBunz: true,
    acceptsBunz: true,
    gallery: JSON.stringify(['https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?auto=format&fit=crop&w=800&q=80']),
    logoUrl: '',
    status: 'APPROVED',
    creditLimit: 5000,
  },
  {
    ownerId: mockOwnerId,
    name: 'Surf & Co.',
    category: 'Deportes & Aventura',
    description: 'Clases de surf, renta de tablas y tienda de accesorios para el mar.',
    address: 'Punta Mita, Nayarit',
    lat: 20.777,
    lng: -105.528,
    rewardPercentage: 20,
    rarity: 'legendary',
    givesBunz: true,
    acceptsBunz: false,
    gallery: JSON.stringify(['https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80']),
    logoUrl: '',
    status: 'APPROVED',
    creditLimit: 12000,
  },
  {
    ownerId: mockOwnerId,
    name: 'BarberKing',
    category: 'Estética & Barbería',
    description: 'La barbería más premiada de la Riviera Nayarit. Cortes, afeitado clásico y más.',
    address: 'Bucerías, Bahía de Banderas, Nayarit',
    lat: 20.7528,
    lng: -105.3338,
    rewardPercentage: 5,
    rarity: 'common',
    givesBunz: true,
    acceptsBunz: false,
    gallery: JSON.stringify(['https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80']),
    logoUrl: '',
    status: 'APPROVED',
    creditLimit: 3000,
  }
];

async function run() {
  for (const b of businesses) {
    try {
      const id = require('crypto').randomUUID();
      const result = await client`
        INSERT INTO "ownedBusinesses" 
        (id, "ownerId", name, category, description, address, lat, lng, "rewardPercentage", rarity, "givesBunz", "acceptsBunz", gallery, "logoUrl", status)
        VALUES (${id}, ${b.ownerId}, ${b.name}, ${b.category}, ${b.description}, ${b.address}, ${b.lat}, ${b.lng}, ${b.rewardPercentage}, ${b.rarity}, ${b.givesBunz}, ${b.acceptsBunz}, ${b.gallery}, ${b.logoUrl}, ${b.status})
        ON CONFLICT DO NOTHING
        RETURNING id, name, status
      `;
      if (result.length > 0) {
        console.log(`✅ Insertado: ${result[0].name} (${result[0].id})`);
      } else {
        console.log(`⏭️  Ya existía: ${b.name}`);
      }
    } catch (err) {
      console.error(`❌ Error insertando ${b.name}:`, err.message);
    }
  }

  // Show final count
  const total = await client`SELECT COUNT(*) as count, status FROM "ownedBusinesses" GROUP BY status`;
  console.log('\n=== Estado final de ownedBusinesses ===');
  total.forEach(r => console.log(`  ${r.status}: ${r.count} negocios`));

  await client.end();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
