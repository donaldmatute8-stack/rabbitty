import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { qrToken } = body;

    const userId = caller.id;

    if (!qrToken) {
      return NextResponse.json({ error: 'Parámetros faltantes' }, { status: 400 });
    }

    // NOTA DE SEGURIDAD: el "reconocimiento óptico" del QR Neón (RabbittyCode) es
    // decorativo — el patrón es un hash visual y NO transporta el token de sesión.
    // Vincular el escaneo a "la sesión pendiente más reciente" permitía un hijack
    // por carrera (cualquiera podía capturar la sesión de otro). El único canal
    // seguro de emparejamiento es el token real contenido en el QR escaneado
    // (qrlogin_<token> → hash → jwtToken de webSessions). Sin token válido no hay login.

    const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');

    // Buscar la sesión válida por hash exacto o por token directo
    let session = await db.query.webSessions.findFirst({
      where: eq(webSessions.jwtToken, tokenHash),
    });

    if (!session) {
      session = await db.query.webSessions.findFirst({
        where: eq(webSessions.jwtToken, `qrlogin_${qrToken}`),
      });
    }

    if (!session) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
    }

    if (session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'QR code has expired' }, { status: 400 });
    }

    if (session.userId) {
      return NextResponse.json({ error: 'QR code already used' }, { status: 400 });
    }

    // Vincular la sesión al usuario verificado que la escaneó
    await db
      .update(webSessions)
      .set({ userId })
      .where(eq(webSessions.id, session.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QR Scan Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
