import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }

    if (!token) {
      try {
        const body = await req.json();
        token = body?.sessionToken || null;
      } catch (e) {
        // ignore body parse failure
      }
    }

    if (token) {
      // Invalidate and revoke the session permanently
      await db.delete(webSessions).where(eq(webSessions.jwtToken, token));
    }

    return NextResponse.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('[LOGOUT ERROR]', error);
    return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 });
  }
}
