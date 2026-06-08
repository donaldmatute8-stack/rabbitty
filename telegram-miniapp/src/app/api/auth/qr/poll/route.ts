import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const session = await db.query.webSessions.findFirst({
      where: eq(webSessions.id, sessionId),
      with: { user: true }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId && session.user) {
      return NextResponse.json({ 
        success: true, 
        authenticated: true,
        user: {
          id: session.user.id,
          telegramId: session.user.telegramId,
          username: session.user.username,
          tonWalletAddress: session.user.tonWalletAddress
        }
      });
    }

    if (session.expiresAt < new Date()) {
      return NextResponse.json({ success: true, authenticated: false, expired: true });
    }

    return NextResponse.json({ success: true, authenticated: false });
  } catch (error) {
    console.error('QR Poll Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
