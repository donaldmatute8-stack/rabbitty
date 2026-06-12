import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { qrToken, userId } = await req.json();

    if (!qrToken || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');

    // Buscar la sesión válida
    const session = await db.query.webSessions.findFirst({
      where: eq(webSessions.jwtToken, tokenHash)
    });

    if (!session) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
    }

    if (session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'QR code has expired' }, { status: 400 });
    }

    if (session.userId) {
      return NextResponse.json({ error: 'QR code already used' }, { status: 400 });
    }

    // Vincular la sesión al usuario que la escaneó
    await db.update(webSessions)
      .set({ userId })
      .where(eq(webSessions.id, session.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QR Scan Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
