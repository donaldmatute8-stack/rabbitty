import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, levels, achievements, hatTricks } from '@/db/schema';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { secret } = await req.json().catch(() => ({}));
    if (secret !== process.env.RABBITTY_API_SECRET && process.env.NODE_ENV === 'production') {
      // En desarrollo o con secret permitimos sembrar
    }

    console.log('🌱 Poblando base de datos con datos mock de negocios y gamificación...');

    // 1. Niveles
    const sampleLevels = [
      { id: 'l1', name: 'Rabbitter Novato', requiredHops: 0, bunzMultiplier: 1.0, premiumAccess: false },
      { id: 'l2', name: 'Explorador Urbano', requiredHops: 50, bunzMultiplier: 1.1, premiumAccess: false },
      { id: 'l3', name: 'Guía de la Madriguera', requiredHops: 200, bunzMultiplier: 1.2, premiumAccess: true },
      { id: 'l4', name: 'Conejo Legendario', requiredHops: 500, bunzMultiplier: 1.5, premiumAccess: true },
    ];
    for (const lvl of sampleLevels) {
      await db.insert(levels).values(lvl).onConflictDoNothing();
    }

    // 2. Usuarios de Prueba
    const sampleUsers = [
      { id: 'u1', telegramId: '798431743', username: 'admin_rabbitty', firstName: 'Marco', lastName: 'Admin', role: 'ADMIN', levelId: 'l2', totalBunzEarned: 1500, totalBunzSpent: 200, visitedBusinesses: 5, hops: 60 },
      { id: 'u2', telegramId: '100002', username: 'alice_rabbitter', firstName: 'Alice', lastName: 'García', role: 'USER', levelId: 'l1', totalBunzEarned: 500, totalBunzSpent: 100, visitedBusinesses: 2, hops: 15 },
      { id: 'u3', telegramId: '100003', username: 'bob_restaurant', firstName: 'Bob', lastName: 'Chef', role: 'USER', levelId: 'l1', totalBunzEarned: 100, totalBunzSpent: 0, visitedBusinesses: 1, hops: 5 },
    ];
    for (const u of sampleUsers) {
      await db.insert(users).values(u).onConflictDoNothing();
    }

    // 3. Negocios Mock para el Mapa y Feed
    const sampleBusinesses = [
      {
        id: 'b1',
        ownerId: 'u1',
        name: 'Café Rabbitty Centro',
        category: 'Cafetería',
        description: 'El mejor café de especialidad y postres artesanales con recompensas en Bunz.',
        address: 'Av. Juárez 42, Centro Histórico, CDMX',
        lat: 19.4326,
        lng: -99.1332,
        logoUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=300&q=80',
        gallery: JSON.stringify(['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80']),
        rewardPercentage: 15,
        rarity: 'epic',
        package: 'Pro',
        creditLimit: 50000,
        creditUsed: 1200,
        givesBunz: true,
        acceptsBunz: true,
        status: 'APPROVED',
        activeDays: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
        startTime: '07:00',
        endTime: '22:00',
        timezone: 'America/Mexico_City'
      },
      {
        id: 'b2',
        ownerId: 'u3',
        name: 'Tacos El Conejo Dorado',
        category: 'Restaurante',
        description: 'Tacos al pastor tradicionales y salsas artesanales en el corazón de la ciudad.',
        address: 'Colima 180, Roma Norte, CDMX',
        lat: 19.4185,
        lng: -99.1620,
        logoUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=300&q=80',
        gallery: JSON.stringify(['https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80']),
        rewardPercentage: 20,
        rarity: 'legendary',
        package: 'Growth',
        creditLimit: 30000,
        creditUsed: 500,
        givesBunz: true,
        acceptsBunz: true,
        status: 'APPROVED',
        activeDays: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
        startTime: '13:00',
        endTime: '01:00',
        timezone: 'America/Mexico_City'
      },
      {
        id: 'b3',
        ownerId: 'u1',
        name: 'Bunz Store Condesa',
        category: 'Tienda',
        description: 'Concept store urbana con ropa local, sneakers y gadgets aceptando Bunz.',
        address: 'Av. Ámsterdam 124, Condesa, CDMX',
        lat: 19.4110,
        lng: -99.1710,
        logoUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=300&q=80',
        gallery: JSON.stringify(['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80']),
        rewardPercentage: 10,
        rarity: 'rare',
        package: 'Enterprise',
        creditLimit: 100000,
        creditUsed: 3400,
        givesBunz: true,
        acceptsBunz: true,
        status: 'APPROVED',
        activeDays: JSON.stringify([1, 2, 3, 4, 5, 6]),
        startTime: '10:00',
        endTime: '20:00',
        timezone: 'America/Mexico_City'
      },
      {
        id: 'b4',
        ownerId: 'u2',
        name: 'Madriguera Cocktail Bar',
        category: 'Bar',
        description: 'Coctelería de autor, música en vivo y descuentos exclusivos de Happy Hour.',
        address: 'Orizaba 42, Roma Norte, CDMX',
        lat: 19.4210,
        lng: -99.1590,
        logoUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=300&q=80',
        gallery: JSON.stringify(['https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80']),
        rewardPercentage: 25,
        rarity: 'legendary',
        package: 'Growth',
        creditLimit: 25000,
        creditUsed: 800,
        givesBunz: true,
        acceptsBunz: true,
        status: 'APPROVED',
        activeDays: JSON.stringify([4, 5, 6, 7]),
        startTime: '18:00',
        endTime: '02:00',
        timezone: 'America/Mexico_City'
      }
    ];

    for (const b of sampleBusinesses) {
      await db.insert(ownedBusinesses).values(b).onConflictDoNothing();
    }

    // 4. Insignias y Logros de Gamificación
    const sampleAchievements = [
      { id: crypto.randomUUID(), name: 'Primer Salto', description: 'Realizaste tu primera visita o consumo.', iconUrl: '🐰', conditionType: 'TOTAL_VISITS', conditionTarget: 1 },
      { id: crypto.randomUUID(), name: 'Explorador Urbano', description: 'Conociste 5 negocios afiliados.', iconUrl: '🗺️', conditionType: 'TOTAL_VISITS', conditionTarget: 5 },
      { id: crypto.randomUUID(), name: 'Amante del Café', description: 'Visitaste 3 cafeterías de la red.', iconUrl: '☕', conditionType: 'CATEGORY_VISITS', conditionTarget: 3 },
      { id: crypto.randomUUID(), name: 'Cazador Épico', description: 'Acumulaste tus primeros 1,000 Bunz.', iconUrl: '🥇', conditionType: 'TOTAL_BUNZ', conditionTarget: 1000 }
    ];
    for (const ach of sampleAchievements) {
      await db.insert(achievements).values(ach).onConflictDoNothing();
    }

    // 5. Trucos del Sombrero (Hat Tricks / Misiones)
    const sampleHatTricks = [
      { id: crypto.randomUUID(), title: 'El Despertar', description: 'Haz tu primer consumo en cualquier negocio.', rewardHops: 100, rewardBunz: 50, conditionType: 'TOTAL_VISITS', conditionTarget: 1, conditionCategory: null, isActive: true },
      { id: crypto.randomUUID(), title: 'Ruta Cafetera', description: 'Visita 2 cafeterías esta semana.', rewardHops: 150, rewardBunz: 100, conditionType: 'CATEGORY_VISITS', conditionTarget: 2, conditionCategory: 'Cafetería', isActive: true },
      { id: crypto.randomUUID(), title: 'Noche de Tacos', description: 'Consume en Tacos El Conejo Dorado.', rewardHops: 200, rewardBunz: 150, conditionType: 'CATEGORY_VISITS', conditionTarget: 1, conditionCategory: 'Restaurante', isActive: true }
    ];
    for (const ht of sampleHatTricks) {
      await db.insert(hatTricks).values(ht).onConflictDoNothing();
    }

    return NextResponse.json({
      success: true,
      message: 'Base de datos poblada exitosamente con negocios mock y gamificación.',
      totalBusinesses: sampleBusinesses.length
    });

  } catch (error: any) {
    console.error('[SEED_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Error al poblar la base de datos' }, { status: 500 });
  }
}
