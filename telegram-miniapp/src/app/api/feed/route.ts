import { NextResponse } from 'next/server';
import { db } from '@/db';

export async function GET() {
  try {
    const businesses = await db.query.ownedBusinesses.findMany({
      orderBy: (businesses, { desc }) => [desc(businesses.createdAt)],
      limit: 20
    });

    const feedItems = businesses.map((b) => {
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
        imageUrl: b.gallery.length > 0 ? JSON.parse(b.gallery)[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
        logo_base64: b.logoUrl,
        lat: b.lat,
        lng: b.lng,
        activeDays: JSON.parse(b.activeDays),
        startTime: b.startTime,
        endTime: b.endTime
      };
    });

    return NextResponse.json({ success: true, data: feedItems });
  } catch (error) {
    console.error('Feed API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
