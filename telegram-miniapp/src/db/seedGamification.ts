import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import crypto from 'crypto';

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log('🌱 Iniciando inyección de datos de Gamificación...');

  try {
    // 1. Inyectar Niveles
    console.log('Inyectando Niveles...');
    const levels = [
      { id: 'lvl_1', name: 'Rabbitter Novato', requiredHops: 0, bunzMultiplier: 1.0, premiumAccess: false },
      { id: 'lvl_2', name: 'Explorador Urbano', requiredHops: 500, bunzMultiplier: 1.02, premiumAccess: false },
      { id: 'lvl_3', name: 'Guía de la Madriguera', requiredHops: 2000, bunzMultiplier: 1.05, premiumAccess: true },
      { id: 'lvl_4', name: 'Conejo Legendario', requiredHops: 5000, bunzMultiplier: 1.10, premiumAccess: true },
    ];
    for (const lvl of levels) {
      await db.insert(schema.levels).values(lvl).onConflictDoNothing();
    }

    // 2. Inyectar 20 Insignias (Achievements)
    console.log('Inyectando Insignias...');
    const achievements = [
      { name: 'Primer Salto', description: 'Realizaste tu primera reserva o mint.', iconUrl: '🐰', conditionType: 'TOTAL_VISITS', conditionTarget: 1 },
      { name: 'Explorador Cíclico', description: 'Alcanzaste 10 consumos totales.', iconUrl: '🗺️', conditionType: 'TOTAL_VISITS', conditionTarget: 10 },
      { name: 'Veterano de la Ciudad', description: 'Lograste 50 consumos totales.', iconUrl: '🏙️', conditionType: 'TOTAL_VISITS', conditionTarget: 50 },
      { name: 'Leyenda Urbana', description: '¡100 consumos totales!', iconUrl: '👑', conditionType: 'TOTAL_VISITS', conditionTarget: 100 },
      
      { name: 'Amante del Café', description: 'Visitaste 5 cafeterías.', iconUrl: '☕', conditionType: 'CATEGORY_VISITS', conditionTarget: 5 },
      { name: 'Sommelier', description: 'Visitaste 5 bares o vinaterías.', iconUrl: '🍷', conditionType: 'CATEGORY_VISITS', conditionTarget: 5 },
      { name: 'Gourmet', description: 'Visitaste 5 restaurantes.', iconUrl: '🍽️', conditionType: 'CATEGORY_VISITS', conditionTarget: 5 },
      { name: 'Vida Nocturna', description: 'Visitaste 10 antros o bares.', iconUrl: '🕺', conditionType: 'CATEGORY_VISITS', conditionTarget: 10 },
      
      { name: 'Conejo Social', description: 'Invitaste a tu primer amigo.', iconUrl: '🤝', conditionType: 'REFERRALS_COUNT', conditionTarget: 1 },
      { name: 'Influencer de la Madriguera', description: 'Invitaste a 10 amigos.', iconUrl: '🌟', conditionType: 'REFERRALS_COUNT', conditionTarget: 10 },
      { name: 'Líder de Manada', description: 'Invitaste a 50 amigos.', iconUrl: '🐺', conditionType: 'REFERRALS_COUNT', conditionTarget: 50 },
      
      { name: 'Cazador Común', description: 'Acumulaste 1000 Bunz.', iconUrl: '🥉', conditionType: 'TOTAL_BUNZ', conditionTarget: 1000 },
      { name: 'Cazador Épico', description: 'Acumulaste 5000 Bunz.', iconUrl: '🥈', conditionType: 'TOTAL_BUNZ', conditionTarget: 5000 },
      { name: 'Cazador Legendario', description: 'Acumulaste 10000 Bunz.', iconUrl: '🥇', conditionType: 'TOTAL_BUNZ', conditionTarget: 10000 },
      
      { name: 'Mochilero', description: 'Alcanzaste 100 Hops.', iconUrl: '🎒', conditionType: 'TOTAL_HOPS', conditionTarget: 100 },
      { name: 'Trotamundos', description: 'Alcanzaste 1000 Hops.', iconUrl: '🌍', conditionType: 'TOTAL_HOPS', conditionTarget: 1000 },
      { name: 'Astro-Conejo', description: 'Alcanzaste 10000 Hops.', iconUrl: '🚀', conditionType: 'TOTAL_HOPS', conditionTarget: 10000 },
      
      { name: 'Buscador de Ofertas', description: 'Realizaste 5 reservas en Stock.', iconUrl: '🎁', conditionType: 'RESERVATIONS', conditionTarget: 5 },
      { name: 'Maestro del Stock', description: 'Realizaste 20 reservas en Stock.', iconUrl: '📦', conditionType: 'RESERVATIONS', conditionTarget: 20 },
      { name: 'El Oráculo', description: 'Llegaste al Nivel Legendario.', iconUrl: '🔮', conditionType: 'LEVEL_REACHED', conditionTarget: 4 },
    ];
    for (const ach of achievements) {
      await db.insert(schema.achievements).values({
        id: crypto.randomUUID(),
        ...ach
      }).onConflictDoNothing();
    }

    // 3. Inyectar 20 Trucos del Sombrero (Misiones dinámicas)
    console.log('Inyectando Trucos del Sombrero...');
    const tricks = [
      { title: 'El Despertar', description: 'Haz tu primer consumo en cualquier negocio.', rewardHops: 100, rewardBunz: 50, conditionType: 'TOTAL_VISITS', conditionTarget: 1, conditionCategory: null },
      { title: 'Semana de Café', description: 'Visita 3 cafeterías.', rewardHops: 150, rewardBunz: 100, conditionType: 'CATEGORY_VISITS', conditionTarget: 3, conditionCategory: 'Cafetería' },
      { title: 'El Gourmet', description: 'Visita 2 restaurantes diferentes.', rewardHops: 200, rewardBunz: 150, conditionType: 'CATEGORY_VISITS', conditionTarget: 2, conditionCategory: 'Restaurante' },
      { title: 'Sed de la Noche', description: 'Visita 3 bares.', rewardHops: 200, rewardBunz: 100, conditionType: 'CATEGORY_VISITS', conditionTarget: 3, conditionCategory: 'Bar' },
      { title: 'Amigo Fiel', description: 'Invita a 3 amigos a la madriguera.', rewardHops: 300, rewardBunz: 150, conditionType: 'REFERRALS_COUNT', conditionTarget: 3, conditionCategory: null },
      
      { title: 'El Cazador Frecuente', description: 'Realiza 5 consumos totales.', rewardHops: 250, rewardBunz: 0, conditionType: 'TOTAL_VISITS', conditionTarget: 5, conditionCategory: null },
      { title: 'El Rescatista', description: 'Salva tu primer paquete de Stock.', rewardHops: 100, rewardBunz: 0, conditionType: 'RESERVATIONS', conditionTarget: 1, conditionCategory: null },
      { title: 'Misión Saludable', description: 'Visita 2 negocios de Salud o Belleza.', rewardHops: 150, rewardBunz: 50, conditionType: 'CATEGORY_VISITS', conditionTarget: 2, conditionCategory: 'Salud' },
      { title: 'Maratón de Compras', description: 'Realiza 10 consumos totales.', rewardHops: 500, rewardBunz: 200, conditionType: 'TOTAL_VISITS', conditionTarget: 10, conditionCategory: null },
      { title: 'El Héroe Local', description: 'Haz 15 consumos.', rewardHops: 750, rewardBunz: 300, conditionType: 'TOTAL_VISITS', conditionTarget: 15, conditionCategory: null },
      
      { title: 'Dulce Tentación', description: 'Visita 2 heladerías o postres.', rewardHops: 100, rewardBunz: 50, conditionType: 'CATEGORY_VISITS', conditionTarget: 2, conditionCategory: 'Postres' },
      { title: 'Gamer', description: 'Visita 2 negocios de entretenimiento.', rewardHops: 150, rewardBunz: 50, conditionType: 'CATEGORY_VISITS', conditionTarget: 2, conditionCategory: 'Entretenimiento' },
      { title: 'Amante de las Mascotas', description: 'Visita 1 veterinaria o tienda de mascotas.', rewardHops: 100, rewardBunz: 50, conditionType: 'CATEGORY_VISITS', conditionTarget: 1, conditionCategory: 'Mascotas' },
      { title: 'Moda y Estilo', description: 'Visita 2 tiendas de ropa.', rewardHops: 150, rewardBunz: 50, conditionType: 'CATEGORY_VISITS', conditionTarget: 2, conditionCategory: 'Ropa' },
      { title: 'Salva Planetas', description: 'Salva 5 paquetes de Stock.', rewardHops: 400, rewardBunz: 100, conditionType: 'RESERVATIONS', conditionTarget: 5, conditionCategory: null },

      { title: 'Embajador de la Marca', description: 'Invita a 10 amigos.', rewardHops: 1000, rewardBunz: 500, conditionType: 'REFERRALS_COUNT', conditionTarget: 10, conditionCategory: null },
      { title: 'Maestro Rescatista', description: 'Salva 10 paquetes de Stock.', rewardHops: 800, rewardBunz: 200, conditionType: 'RESERVATIONS', conditionTarget: 10, conditionCategory: null },
      { title: 'Adicto a la Cafeína', description: 'Visita 10 cafeterías.', rewardHops: 500, rewardBunz: 200, conditionType: 'CATEGORY_VISITS', conditionTarget: 10, conditionCategory: 'Cafetería' },
      { title: 'El Viajero', description: 'Llega a 20 consumos totales.', rewardHops: 1000, rewardBunz: 0, conditionType: 'TOTAL_VISITS', conditionTarget: 20, conditionCategory: null },
      { title: 'El Conejo Definitivo', description: 'Llega a 50 consumos totales.', rewardHops: 2500, rewardBunz: 1000, conditionType: 'TOTAL_VISITS', conditionTarget: 50, conditionCategory: null },
    ];
    for (const trick of tricks) {
      await db.insert(schema.hatTricks).values({
        id: crypto.randomUUID(),
        ...trick
      }).onConflictDoNothing();
    }

    console.log('✅ Inyección completada exitosamente.');
  } catch (e) {
    console.error('Error durante la inyección:', e);
  } finally {
    await pool.end();
  }
}

seed();
