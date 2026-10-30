import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions, verificationTokens } from '@/db/schema';
import { eq, like } from 'drizzle-orm';

export const runtime = 'nodejs';

/** Fast Login — revoca el fastToken (logout definitivo, biometría desactivada, cuenta eliminada). */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
    if (!token) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const [session] = await db.select().from(webSessions).where(eq(webSessions.jwtToken, token)).limit(1);
    if (!session?.userId) return NextResponse.json({ success: true }); // nada que revocar

    await db.delete(verificationTokens).where(like(verificationTokens.identifier, `fastlogin:${session.userId}`));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FAST-LOGIN REVOKE ERROR]', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
