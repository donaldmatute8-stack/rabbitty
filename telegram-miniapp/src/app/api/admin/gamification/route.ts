import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { levels, hatTricks, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Verify Admin Middleware logic (reusable)
async function verifyAdmin(req: NextRequest) {
  // We expect user id or telegram id in headers, but since we are calling from client,
  // let's just pass telegramId in headers for this simple admin panel.
  const telegramId = req.headers.get('X-Telegram-Id');
  if (telegramId !== "798431743") {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const allLevels = await db.query.levels.findMany({ orderBy: (levels, { asc }) => [asc(levels.requiredHops)] });
    const allTricks = await db.query.hatTricks.findMany({ orderBy: (hatTricks, { desc }) => [desc(hatTricks.createdAt)] });

    return NextResponse.json({ levels: allLevels, tricks: allTricks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
