import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, webSessions, referrals } from '@/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const customHeader = req.headers.get('x-session-token');

    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 401 });
    }

    // Lookup session in webSessions
    const session = await db.query.webSessions.findFirst({
      where: and(
        eq(webSessions.jwtToken, token),
        gt(webSessions.expiresAt, new Date())
      ),
    });

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
    }

    // Fetch canonical user profile
    const profile = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      with: { level: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Pending referral bunz
    let pendingBunz = 0;
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
    }).from(referrals)
      .where(and(eq(referrals.inviterId, profile.id), eq(referrals.status, 'PENDING')));
    pendingBunz = result[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        pendingBunz,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[AUTH SESSION ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
