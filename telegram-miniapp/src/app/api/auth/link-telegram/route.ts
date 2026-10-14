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
    const { initData, confirmMerge } = body;

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

      // If existing user has balances or history and caller hasn't confirmed
      if (!confirmMerge) {
        return NextResponse.json({
          requiresConfirmation: true,
          error: 'Esta cuenta de Telegram ya está asociada a un perfil con historial.',
          existingProfile: {
            username: existing.username,
            totalBunzEarned: existing.totalBunzEarned,
          },
          message: `Tu cuenta de Telegram posee ${existing.totalBunzEarned} Bunz acumulados. ¿Deseas unificar el saldo a este dispositivo?`,
        }, { status: 409 });
      }

      // Atomic merge transaction: transfer balances and reassign telegramId
      const targetUserId = session.userId!;
      const updatedUser = await db.transaction(async (tx: any) => {
        const [targetUser] = await tx.select().from(users).where(eq(users.id, targetUserId)).for('update');
        const [sourceUser] = await tx.select().from(users).where(eq(users.id, existing.id)).for('update');

        if (!targetUser || !sourceUser) {
          throw new Error('No se pudo encontrar uno de los perfiles para unificar');
        }

        // 1. Release telegramId from old profile and mark as merged
        await tx.update(users).set({
          telegramId: null,
          role: 'MERGED',
          updatedAt: new Date(),
        }).where(eq(users.id, sourceUser.id));

        // 2. Transfer balances to target canonical user
        const newEarned = (targetUser.totalBunzEarned || 0) + (sourceUser.totalBunzEarned || 0);
        const newSpent = (targetUser.totalBunzSpent || 0) + (sourceUser.totalBunzSpent || 0);

        const [merged] = await tx.update(users).set({
          telegramId,
          totalBunzEarned: newEarned,
          totalBunzSpent: newSpent,
          updatedAt: new Date(),
        }).where(eq(users.id, targetUser.id)).returning();

        return merged;
      });

      return NextResponse.json({
        success: true,
        merged: true,
        message: 'Cuentas y saldos Bunz unificados exitosamente.',
        user: updatedUser,
      });
    }

    // Link telegramId to current canonical user directly if not previously used
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
