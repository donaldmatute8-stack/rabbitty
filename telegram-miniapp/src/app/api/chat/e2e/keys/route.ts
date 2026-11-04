import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { userDeviceKeys } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const B64URL = /^[A-Za-z0-9_-]{40,200}$/;

/**
 * ── POST /api/chat/e2e/keys ── registra la clave PÚBLICA del dispositivo.
 * Body: { deviceId, publicKey }
 *
 * La clave privada nunca sale del dispositivo. Aquí solo hay material público.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { deviceId?: string; publicKey?: string } | null;
    const deviceId = (body?.deviceId ?? '').trim();
    const publicKey = (body?.publicKey ?? '').trim();

    if (!deviceId || deviceId.length > 80) {
      return NextResponse.json({ success: false, error: 'deviceId inválido' }, { status: 400 });
    }
    if (!B64URL.test(publicKey)) {
      return NextResponse.json({ success: false, error: 'publicKey inválida' }, { status: 400 });
    }

    await db
      .insert(userDeviceKeys)
      .values({ userId: caller.id, deviceId, publicKey })
      .onConflictDoUpdate({
        target: [userDeviceKeys.userId, userDeviceKeys.deviceId],
        set: { publicKey, lastSeenAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[E2E KEYS POST]', error);
    return NextResponse.json({ success: false, error: 'No se pudo registrar la clave' }, { status: 500 });
  }
}

/**
 * ── GET /api/chat/e2e/keys?userIds=a,b ── claves públicas de esos usuarios.
 * Solo material público: sirve para envolver la clave de conversación.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const raw = (url.searchParams.get('userIds') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ids = Array.from(new Set(raw.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 20);
    if (ids.length === 0) return NextResponse.json({ success: true, keys: [] });

    const rows = await db
      .select({
        userId: userDeviceKeys.userId,
        deviceId: userDeviceKeys.deviceId,
        publicKey: userDeviceKeys.publicKey,
      })
      .from(userDeviceKeys)
      .where(and(inArray(userDeviceKeys.userId, ids)));

    return NextResponse.json({ success: true, keys: rows });
  } catch (error) {
    console.error('[E2E KEYS GET]', error);
    return NextResponse.json({ success: false, error: 'No se pudieron leer las claves' }, { status: 500 });
  }
}
