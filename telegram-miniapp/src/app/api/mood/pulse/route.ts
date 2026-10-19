import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { moodEvents } from '@/db/schema';
import { eq, and, sql, gte } from 'drizzle-orm';
import { MoodType, MOOD_DEFINITIONS } from '@/types/mood';

/**
 * GET /api/mood/pulse?businessId=...
 * Aggregated Mood Intelligence Endpoint for Affiliates & Venue Screens.
 * 
 * Strict Privacy Rules:
 * 1. Anonymized: Zero PII or individual names returned.
 * 2. Privacy Threshold: If fewer than 3 participants, returns 'INSUFFICIENT_DATA' to prevent deducing individual answers.
 * 3. Time window: Defaults to past 24 hours or customizable hours param.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const businessId = url.searchParams.get('businessId');
    const hours = Math.min(Math.max(parseInt(url.searchParams.get('hours') || '24', 10), 1), 168);

    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const conditions = [gte(moodEvents.createdAt, sinceDate)];
    if (businessId) {
      conditions.push(eq(moodEvents.businessId, businessId));
    }

    // 1. Query aggregated mood breakdown
    const breakdown = await db
      .select({
        mood: moodEvents.mood,
        count: sql<number>`count(*)::int`,
      })
      .from(moodEvents)
      .where(and(...conditions))
      .groupBy(moodEvents.mood);

    const totalCount = breakdown.reduce((acc, row) => acc + (row.count || 0), 0);

    // If below threshold, protect customer privacy (minimum 10 responses required)
    const PRIVACY_THRESHOLD = 10;
    if (totalCount < PRIVACY_THRESHOLD) {
      return NextResponse.json({
        success: true,
        status: 'INSUFFICIENT_DATA',
        message: `Se requieren al menos ${PRIVACY_THRESHOLD} check-ins para generar métricas agregadas y proteger la privacidad de los comensales.`,
        totalParticipants: totalCount,
        threshold: PRIVACY_THRESHOLD,
        windowHours: hours,
      });
    }

    // Map counts with percentages and definitions
    const distribution = breakdown.map((row) => {
      const moodKey = row.mood as MoodType;
      const def = MOOD_DEFINITIONS[moodKey];
      const count = Number(row.count);
      const percentage = Math.round((count / totalCount) * 100);

      return {
        mood: moodKey,
        label: def?.label || moodKey,
        emoji: def?.emoji || '✨',
        accentHex: def?.accentHex || '#FFFFFF',
        count,
        percentage,
      };
    }).sort((a, b) => b.count - a.count);

    // Dominant vibe of the space
    const dominantMood = distribution[0] || null;

    // Atmosphere Recipe: Actionable operational guidance for staff
    let atmosphereRecipe = {
      title: 'Equilibrio Acústico & Hospitalidad',
      action: 'Mantener volumen sutil y observar las mesas.',
      lighting: 'Luz ambiental cálida normal.',
      soundtrack: 'Rabbitty Acoustic Curations',
      pairing: 'Recomendar especiales de temporada del menú.',
    };

    if (dominantMood) {
      switch (dominantMood.mood) {
        case 'calm':
          atmosphereRecipe = {
            title: 'Receta de Desconexión & Calma',
            action: 'Bajar 2 puntos el volumen ambiental y evitar ruidos mecánicos cerca de mesas.',
            lighting: 'Atenuar luces directas; privilegiar lámparas de mesa y calidez.',
            soundtrack: 'Rabbitty Peaceful Ambient & Lo-Fi Chill',
            pairing: 'Sugerir infusiones botánicas, Flat White descafeinado y repostería suave.',
          };
          break;
        case 'focus':
          atmosphereRecipe = {
            title: 'Receta de Deep Focus & Concentración',
            action: 'Mantener música 100% instrumental sin letras; asegurar acceso visible a enchufes y WiFi.',
            lighting: 'Iluminación clara y nítida en zonas de trabajo.',
            soundtrack: 'Rabbitty Deep Focus & Minimal Piano',
            pairing: 'Destacar Matcha ceremonial, Cold Brew concentrado y snacks proteicos.',
          };
          break;
        case 'energy':
          atmosphereRecipe = {
            title: 'Receta de Activación & Dinamismo',
            action: 'Aumentar sutilmente el tempo musical; servicio ágil en mostrador.',
            lighting: 'Iluminación viva y apertura de luz natural si es de día.',
            soundtrack: 'Rabbitty Morning Motivation & Upbeat Rhythms',
            pairing: 'Promover Espresso Tonic, Smoothies energéticos y bowls de fruta fresca.',
          };
          break;
        case 'celebration':
          atmosphereRecipe = {
            title: 'Receta de Celebración & Fiesta',
            action: 'Ambientación sonora vibrante y sugerencias de brindis para grupos.',
            lighting: 'Atenuación nocturna con acentos de color o velas.',
            soundtrack: 'Rabbitty Nu-Disco & Golden Hour Grooves',
            pairing: 'Ofrecer botellas al centro, tablas para picar o postre especial de festejo.',
          };
          break;
        case 'connection':
          atmosphereRecipe = {
            title: 'Receta de Convivencia & Charla',
            action: 'Volumen moderado que permita conversar cómodamente sin alzar la voz.',
            lighting: 'Luz suave y acogedora centrada en las mesas.',
            soundtrack: 'Rabbitty Warm Acoustic & Soulful Melodies',
            pairing: 'Jarras de café de prensa, tés para compartir y platos al centro.',
          };
          break;
        case 'surprise':
          atmosphereRecipe = {
            title: 'Receta de Descubrimiento & Vanguardia',
            action: 'Presentar la creación experimental del día fuera de carta.',
            lighting: 'Atmósfera sofisticada con contrastes de luz y sombra.',
            soundtrack: 'Rabbitty Eclectic Indie & Global Explorations',
            pairing: 'Sugerencia secreta del barista o plato de autor de edición limitada.',
          };
          break;
      }
    }

    return NextResponse.json({
      success: true,
      status: 'ACTIVE_PULSE',
      businessId: businessId || 'global',
      windowHours: hours,
      totalParticipants: totalCount,
      dominantMood,
      atmosphereRecipe,
      distribution,
    });
  } catch (err: unknown) {
    console.error('[Mood Pulse API Error]:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
