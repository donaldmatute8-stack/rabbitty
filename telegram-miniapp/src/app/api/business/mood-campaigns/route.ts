import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedBusinesses, moodCampaigns, moodEvents } from '@/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { MoodType } from '@/types/mood';

const VALID_MOODS: MoodType[] = ['calm', 'energy', 'focus', 'celebration', 'connection', 'surprise'];

async function authorize(req: NextRequest, businessId: string | null | undefined) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  if (!businessId) return { error: NextResponse.json({ error: 'businessId requerido' }, { status: 400 }) };

  const business = await db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, businessId) });
  if (!business) return { error: NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 }) };
  if (business.ownerId !== caller.id && caller.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { caller, business };
}

const clampHour = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
};

/** GET /api/business/mood-campaigns?businessId=... */
export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('businessId');
    const auth = await authorize(req, businessId);
    if ('error' in auth) return auth.error;

    const campaigns = await db.select().from(moodCampaigns)
      .where(eq(moodCampaigns.businessId, businessId!))
      .orderBy(desc(moodCampaigns.createdAt));

    // Métricas por campaña: check-ins coincidentes en los últimos 30 días
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await db.query.moodEvents.findMany({
      where: and(
        eq(moodEvents.businessId, businessId!),
        gte(moodEvents.createdAt, sinceDate)
      ),
      columns: {
        mood: true,
        metadata: true,
      },
    });

    const campaignsWithMetrics = campaigns.map((c) => {
      const matchCount = events.filter((e) => {
        if (e.mood !== c.targetMood) return false;
        const meta = e.metadata as Record<string, unknown> | null;
        const rawHour = meta?.hourOfDay;
        const hour = typeof rawHour === 'number' && rawHour >= 0 && rawHour <= 23 ? rawHour : new Date().getHours();
        if (c.startHour <= c.endHour) {
          return hour >= c.startHour && hour <= c.endHour;
        }
        return hour >= c.startHour || hour <= c.endHour;
      }).length;

      return {
        ...c,
        matches30d: matchCount,
      };
    });

    return NextResponse.json({ success: true, campaigns: campaignsWithMetrics });
  } catch (err) {
    console.error('[mood-campaigns GET]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** POST { businessId, targetMood, title, description?, rewardBunz?, startHour?, endHour? } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const auth = await authorize(req, body.businessId);
    if ('error' in auth) return auth.error;

    const title = String(body.title || '').trim().slice(0, 80);
    if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
    if (!VALID_MOODS.includes(body.targetMood)) {
      return NextResponse.json({ error: 'INVALID_MOOD', validMoods: VALID_MOODS }, { status: 400 });
    }

    const rewardBunz = Math.min(Math.max(parseInt(body.rewardBunz ?? 0, 10) || 0, 0), 1000);

    const [campaign] = await db.insert(moodCampaigns).values({
      businessId: body.businessId,
      title,
      description: body.description ? String(body.description).trim().slice(0, 240) : null,
      targetMood: body.targetMood,
      rewardBunz,
      startHour: clampHour(body.startHour, 0),
      endHour: clampHour(body.endHour, 23),
      isActive: true,
    }).returning();

    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    console.error('[mood-campaigns POST]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** PATCH { businessId, id, isActive } — activar/pausar */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const auth = await authorize(req, body.businessId);
    if ('error' in auth) return auth.error;
    if (!body.id || typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'id e isActive requeridos' }, { status: 400 });
    }

    const [campaign] = await db.update(moodCampaigns)
      .set({ isActive: body.isActive, updatedAt: new Date() })
      .where(and(eq(moodCampaigns.id, body.id), eq(moodCampaigns.businessId, body.businessId)))
      .returning();
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    console.error('[mood-campaigns PATCH]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** DELETE ?businessId=...&id=... */
export async function DELETE(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const businessId = params.get('businessId');
    const id = params.get('id');
    const auth = await authorize(req, businessId);
    if ('error' in auth) return auth.error;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    await db.delete(moodCampaigns)
      .where(and(eq(moodCampaigns.id, id), eq(moodCampaigns.businessId, businessId!)));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[mood-campaigns DELETE]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
