import { NextResponse } from 'next/server';
import { db } from '@/db';

import { ownedBusinesses } from '@/db/schema';
import { desc } from 'drizzle-orm';

const parseSafeJson = (str: string | null | undefined, fallback: any = []) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

export async function GET() {
  try {
    const businesses = await db.select().from(ownedBusinesses).orderBy(desc(ownedBusinesses.createdAt)).limit(20);

    const feedItems = businesses.map((b) => {
      const parsedGallery = parseSafeJson(b.gallery);
      const imageUrl = parsedGallery.length > 0 ? parsedGallery[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80';
      const activeDays = parseSafeJson(b.activeDays, [1, 2, 3, 4, 5, 6, 7]);

      return {
        id: b.id,
        user: b.name,
        device: b.category || 'General',
        category: b.category || 'General',
        time: 'Reciente',
        label: 'Cerca',
        bunz: b.rewardPercentage,
        reward_percentage: b.rewardPercentage,
        givesBunz: b.givesBunz,
        acceptsBunz: b.acceptsBunz,
        distance: 0,
        imageUrl,
        logo_base64: b.logoUrl,
        lat: b.lat,
        lng: b.lng,
        activeDays,
        startTime: b.startTime,
        endTime: b.endTime
      };
    });

    return NextResponse.json({ success: true, data: feedItems });
  } catch (error: any) {
    console.error('Feed API Error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error?.message || String(error) }, { status: 500 });
  }
}
