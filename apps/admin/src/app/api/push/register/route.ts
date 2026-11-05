import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@rabbitty/auth';
import { getCoreDb } from '@rabbitty/api/db';
import { pushDevices, users } from '@rabbitty/database-core';

export const runtime = 'nodejs';

/**
 * Registro del token push de la app nativa del POS (com.rabbitty.pos).
 * El sender de la miniapp usa `appId` como `apns-topic`.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      platform?: string;
      appId?: string;
    };
    const token = (body.token || '').trim().slice(0, 4096);
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

    const platform = (body.platform || 'ios').trim().slice(0, 20);
    const appId = (body.appId || 'com.rabbitty.pos').trim().slice(0, 120);

    const coreDb = getCoreDb();
    const [coreUser] = await coreDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!coreUser?.id) {
      return NextResponse.json({ error: 'Usuario sin cuenta en Rabbitty' }, { status: 404 });
    }

    await coreDb
      .insert(pushDevices)
      .values({
        userId: coreUser.id,
        token,
        platform,
        appId,
        isActive: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushDevices.token,
        set: {
          userId: coreUser.id,
          platform,
          appId,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POS_PUSH_REGISTER]', error);
    return NextResponse.json({ error: 'No se pudo registrar el token' }, { status: 500 });
  }
}
