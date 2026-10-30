import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { webSessions, verificationTokens, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/** Fast Login — canjea el fastToken (gate local: Face ID / PIN) por una sesión nueva. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fastToken = String(body?.fastToken || '');
    if (!fastToken.includes('.')) return NextResponse.json({ success: false, error: 'fastToken inválido' }, { status: 400 });

    const dotIdx = fastToken.indexOf('.');
    const userId = fastToken.slice(0, dotIdx);
    const secret = fastToken.slice(dotIdx + 1);
    if (!userId || !secret) return NextResponse.json({ success: false, error: 'fastToken inválido' }, { status: 400 });

    const expectedHash = crypto.createHash('sha256').update(secret).digest('hex');
    const [row] = await db.select().from(verificationTokens)
      .where(eq(verificationTokens.identifier, `fastlogin:${userId}`)).limit(1);

    const ok = !!row
      && row.expires > new Date()
      && crypto.timingSafeEqual(Buffer.from(row.token), Buffer.from(expectedHash));
    if (!ok) {
      if (row) await db.delete(verificationTokens).where(eq(verificationTokens.identifier, `fastlogin:${userId}`));
      return NextResponse.json({ success: false, error: 'Fast login expirado o revocado' }, { status: 401 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await db.insert(webSessions).values({
      jwtToken: sessionToken,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return NextResponse.json({
      success: true,
      sessionToken,
      user: { id: user.id, username: user.username, phoneNumber: user.phoneNumber },
    });
  } catch (error) {
    console.error('[FAST-LOGIN VERIFY ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo iniciar sesión' }, { status: 500 });
  }
}
