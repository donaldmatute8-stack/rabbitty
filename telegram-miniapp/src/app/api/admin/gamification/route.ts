import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { levels, hatTricks, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { getVerifiedAdminId, isAdminAllowed } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const allLevels = await db.query.levels.findMany({ orderBy: (levels, { asc }) => [asc(levels.requiredHops)] });
    const allTricks = await db.query.hatTricks.findMany({ orderBy: (hatTricks, { desc }) => [desc(hatTricks.createdAt)] });

    return NextResponse.json({ levels: allLevels, tricks: allTricks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    if (action === 'CREATE_TRICK') {
      const newTrick = {
        id: crypto.randomUUID(),
        title: payload.title,
        description: payload.description,
        rewardHops: parseInt(payload.rewardHops),
        rewardBunz: parseInt(payload.rewardBunz),
        conditionType: payload.conditionType,
        conditionTarget: parseInt(payload.conditionTarget),
        conditionCategory: payload.conditionCategory || null,
        isActive: true,
      };
      
      await db.insert(hatTricks).values(newTrick);
      return NextResponse.json({ success: true, trick: newTrick });
    }

    if (action === 'UPDATE_LEVEL') {
      await db.update(levels)
        .set({ 
          bunzMultiplier: parseFloat(payload.bunzMultiplier),
          requiredHops: parseInt(payload.requiredHops)
        })
        .where(eq(levels.id, payload.id));
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin POST Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
