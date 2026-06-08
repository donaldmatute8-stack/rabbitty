import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');
    const telegramId = searchParams.get('telegramId');

    if (!wallet && !telegramId) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400 });
    }

    let user;
    if (telegramId) {
      user = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId)
      });
    } else if (wallet) {
      user = await db.query.users.findFirst({
        where: eq(users.tonWalletAddress, wallet)
      });
    }

    if (!user) {
      return NextResponse.json({ success: true, business: null });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.ownerId, user.id)
    });

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Business API GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      name, description, category, address, 
      rewardPercentage, gallery, activeDays, startTime, endTime, telegramId
    } = body;

    let owner = null;
    if (telegramId) {
      owner = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId)
      });
    }

    if (!owner) {
      // Create a mock owner if none provided/found
      const [newOwner] = await db.insert(users).values({
        telegramId: "SYSTEM_OWNER_" + Date.now(),
        totalBunzEarned: 0
      }).returning();
      owner = newOwner;
    }

    const lat = 19.4326 + (Math.random() - 0.5) * 0.05;
    const lng = -99.1332 + (Math.random() - 0.5) * 0.05;

    const parsedReward = parseInt(rewardPercentage);
    let rarity = "common";
    if (parsedReward >= 15) rarity = "legendary";
    else if (parsedReward >= 10) rarity = "epic";
    else if (parsedReward >= 5) rarity = "rare";

    const [business] = await db.insert(ownedBusinesses).values({
      ownerId: owner.id,
      name,
      description,
      category,
      address,
      lat,
      lng,
      rewardPercentage: parsedReward,
      rarity,
      activeDays: JSON.stringify(activeDays || [1,2,3,4,5,6,7]),
      startTime: startTime || "00:00",
      endTime: endTime || "23:59",
      gallery: JSON.stringify(gallery || []),
      logoUrl: gallery && gallery.length > 0 ? gallery[0] : null
    }).returning();

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Business API POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
