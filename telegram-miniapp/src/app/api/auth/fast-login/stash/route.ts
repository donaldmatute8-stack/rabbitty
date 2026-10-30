import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { webSessions, verificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Fast Login — stash server-issued.
 * El logout revoca la sesión (DELETE webSessions), así que el token original muere.
 * Aquí emitimos un fastToken DEDICADO que sobrevive al logout y solo sirve para re-login.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
    if (!token) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const [session] = await db.select().from(webSessions).where(eq(webSessions.jwtToken, token)).limit(1);
    if (!session || session.expiresAt < new Date()) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 });

    const secret = crypto.randomBytes(24).toString('hex');
    const fastToken = `${session.userId}.${secret}`;
    const tokenHash = crypto.createHash('sha256').update(secret).digest('hex');

    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, `fastlogin:${session.userId}`));
    await db.insert(verificationTokens).values({
      identifier: `fastlogin:${session.userId}`,
      token: tokenHash,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return NextResponse.json({ success: true, fastToken });
  } catch (error) {
    console.error('[FAST-LOGIN STASH ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo guardar el fast login' }, { status: 500 });
  }
}
