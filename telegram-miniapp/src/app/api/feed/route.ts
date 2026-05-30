import { NextResponse } from 'next/server';
import { db } from '@/db';

export async function GET() {
  try {
    const businesses = await db.query.ownedBusinesses.findMany({
      orderBy: (businesses, { desc }) => [desc(businesses.createdAt)],
      limit: 20
    });

    // Map Prisma models to the FeedItem format expected by the frontend
    const feedItems = businesses.map((b, i) => {
      const categories = ['Cafetería', 'Restaurante', 'Bar', 'Fitness', 'Tecnología'];
      const mockCategory = categories[i % categories.length];
      const givesBunz = i % 2 === 0;
      const acceptsBunz = i % 3 === 0;
      const reward = b.rewardPercentage > 0 ? b.rewardPercentage : ((i % 4) * 5 + 5);

      return {
        id: b.id,
        user: b.name,
        device: b.category || mockCategory,
        category: b.category || mockCategory,
        time: 'Reciente',
        label: 'Cerca', 
        bunz: reward,
        reward_percentage: reward,
        givesBunz: givesBunz,
        acceptsBunz: acceptsBunz,
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
