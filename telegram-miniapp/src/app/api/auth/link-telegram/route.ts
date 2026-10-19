import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, webSessions, auditEntries } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegramAuth';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
      const mergedUser = await db.transaction(async (tx: TxClient) => {
        const [targetUser] = await tx.select().from(users).where(eq(users.id, targetUserId)).for('update');
        const [sourceUser] = await tx.select().from(users).where(eq(users.id, existing.id)).for('update');

        if (!targetUser || !sourceUser) {
          throw new Error('No se pudo encontrar uno de los perfiles para unificar');
        }

        // Re-check after locking: the source may already have been merged by a
        // concurrent request with the same credentials.
        if (sourceUser.telegramId !== telegramId || sourceUser.role === 'MERGED') {
          throw new Error('ALREADY_MERGED');
        }

        if (targetUser.telegramId && targetUser.telegramId !== telegramId) {
          throw new Error('TARGET_HAS_LINK');
        }

        const sourceEarned = sourceUser.totalBunzEarned || 0;

        // 1. Release telegramId from old profile and mark as merged
        await tx.update(users).set({
          telegramId: null,
          role: 'MERGED',
          updatedAt: new Date(),
        }).where(eq(users.id, sourceUser.id));

        // 2. Transfer balances (earned, spent and offline debt) to target canonical user
        const newEarned = (targetUser.totalBunzEarned || 0) + sourceEarned;
        const newSpent = (targetUser.totalBunzSpent || 0) + (sourceUser.totalBunzSpent || 0);
        const newDebt = (targetUser.pendingDebtBunz || 0) + (sourceUser.pendingDebtBunz || 0);

        const [merged] = await tx.update(users).set({
          telegramId,
          totalBunzEarned: newEarned,
          totalBunzSpent: newSpent,
          pendingDebtBunz: newDebt,
          updatedAt: new Date(),
        }).where(eq(users.id, targetUser.id)).returning();

        // 3. Authoritative Ledger entry for the balance migration
        await recordLedgerTransaction(
          {
            payerSubjectId: `usr_${sourceUser.id}`,
            payeeSubjectId: `usr_${merged.id}`,
            amount: sourceEarned,
            type: 'TRANSFER',
            referenceId: sourceUser.id,
            idempotencyKey: `merge_${sourceUser.id}_${merged.id}`,
            metadata: {
              merge: true,
              sourceUserId: sourceUser.id,
              targetUserId: merged.id,
              earnedTransferred: sourceEarned,
              debtTransferred: newDebt,
              telegramId,
            },
          },
          tx
        );

        // 4. Audit trail
        await tx.insert(auditEntries).values({
          userId: merged.id,
          action: 'ACCOUNT_MERGE',
          resource: 'users',
          resourceId: sourceUser.id,
          details: JSON.stringify({
            sourceUserId: sourceUser.id,
            telegramId,
            earnedTransferred: sourceEarned,
            debtTransferred: newDebt,
          }),
        });

        return merged;
      });

      return NextResponse.json({
        success: true,
        merged: true,
        message: 'Cuentas y saldos Bunz unificados exitosamente.',
        user: mergedUser,
      });
    }

    // Link telegramId to current canonical user directly if not previously used
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Sesión vinculada a un usuario inexistente' }, { status: 401 });
    }

    if (targetUser.telegramId && targetUser.telegramId !== telegramId) {
      return NextResponse.json({
        requiresConfirmation: true,
        error: 'Este perfil ya tiene otra cuenta de Telegram vinculada.',
        currentLink: targetUser.telegramId,
        message: 'Este perfil ya tiene otra cuenta de Telegram vinculada. Desvincúlala primero antes de vincular esta.',
      }, { status: 409 });
    }

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
    const message = error instanceof Error ? error.message : '';
    if (message === 'ALREADY_MERGED') {
      return NextResponse.json({ success: true, merged: true, message: 'Esta cuenta ya se encontraba vinculada y unificada.' });
    }
    if (message === 'TARGET_HAS_LINK') {
      return NextResponse.json({ error: 'Este perfil ya tiene otra cuenta de Telegram vinculada. Desvincúlala primero.' }, { status: 409 });
    }
    console.error('[LINK TELEGRAM ERROR]', error);
    return NextResponse.json({ error: 'Error al vincular cuenta de Telegram' }, { status: 500 });
  }
}
