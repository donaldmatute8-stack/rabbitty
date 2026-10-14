import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, webSessions } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegramAuth';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Debes iniciar sesión para vincular una cuenta' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const session = await db.query.webSessions.findFirst({
      where: and(
        eq(webSessions.jwtToken, token),
        gt(webSessions.expiresAt, new Date())
      ),
    });

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
    }

    const body = await req.json();
    const { initData } = body;

    if (!initData) {
      return NextResponse.json({ error: 'Falta initData de Telegram' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta (TELEGRAM_BOT_TOKEN)' }, { status: 500 });
    }

    const isValid = validateTelegramInitData(initData, botToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Firma criptográfica de Telegram inválida' }, { status: 401 });
    }

    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'No se pudo leer la identidad de Telegram' }, { status: 400 });
    }

    const telegramId = tUser.id.toString();

    // Check if telegramId is already linked to another account
    const existing = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });

    if (existing) {
      if (existing.id === session.userId) {
        return NextResponse.json({ success: true, message: 'Esta cuenta ya se encuentra vinculada' });
      }
      return NextResponse.json({
        error: 'Esta cuenta de Telegram ya está asociada a otro usuario. Para proteger tus fondos, no se realiza fusión automática.',
      }, { status: 409 });
    }

    // Link telegramId to current canonical user
    const [updatedUser] = await db.update(users).set({
      telegramId,
      updatedAt: new Date(),
    }).where(eq(users.id, session.userId)).returning();

    return NextResponse.json({
      success: true,
      message: 'Cuenta de Telegram vinculada con éxito',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[LINK TELEGRAM ERROR]', error);
    return NextResponse.json({ error: 'Error al vincular cuenta de Telegram' }, { status: 500 });
  }
}
