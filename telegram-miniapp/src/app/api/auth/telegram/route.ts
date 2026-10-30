import { NextResponse } from 'next/server';
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegramAuth';
import { resolveUniqueUsername } from '@/lib/username';
import { db } from '@/db';
import { users, referrals, webSessions, ownedBusinesses, pendingVaults } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';

export async function POST(req: Request) {
  try {
    const { initData, startParam } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: 'Server misconfiguration: missing bot token' }, { status: 500 });
    }

    const isValid = validateTelegramInitData(initData, botToken);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'Could not parse user data' }, { status: 400 });
    }

    const telegramId = tUser.id.toString();
    
    let user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId)
    });

    const isNewUser = !user;

    if (!user) {
      const username = tUser.username ? await resolveUniqueUsername(tUser.username) : null;
      const [newUser] = await db.insert(users).values({
        telegramId,
        username,
        firstName: tUser.first_name || null,
        lastName: tUser.last_name || null,
        totalBunzEarned: 0
      }).returning();
      user = newUser;
    }

    if (startParam && startParam.startsWith('ref_') && isNewUser) {
      const inviterTelegramId = startParam.replace('ref_', '');
      
      if (inviterTelegramId !== telegramId) {
        const inviter = await db.query.users.findFirst({
          where: eq(users.telegramId, inviterTelegramId)
        });

        if (inviter) {
          await db.insert(referrals).values({
            inviterId: inviter.id,
            invitedId: user.id,
            status: "PENDING",
            rewardAmount: 50
          });
        }
      }
    }

    // Manejo de códigos promocionales de carteles / impresos (ej. promo_626cafe) con Split Triangular + Push Notification
    if (startParam && startParam.startsWith('promo_')) {
      const promoBusinessSlug = startParam.replace('promo_', '').trim().toLowerCase();
      if (isNewUser || (user.totalBunzEarned || 0) === 0) {
        const { claimWelcomeBonusForUser } = await import('@/lib/welcomeBonusConfig');
        await claimWelcomeBonusForUser({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          promoRef: promoBusinessSlug,
        });
      }
    }

    if (startParam && startParam.startsWith('claim_')) {
      const claimId = startParam.replace('claim_', ''); // UUID sin guiones o ticket orderNumber

      // 1. Buscar si corresponde a un reclamo de negocio afiliado
      const [business] = await db
        .select({ id: ownedBusinesses.id, ownerId: ownedBusinesses.ownerId })
        .from(ownedBusinesses)
        .where(eq(sql`REPLACE(${ownedBusinesses.id}::text, '-', '')`, claimId))
        .limit(1);

      if (business) {
        // ── Seg. STRIX-0021: la transferencia de negocio JAMÁS por un start-param
        // público (sin auditoría, sin 2FA, sin consentimiento del dueño). Va por el
        // flujo God Admin con 2FA. ──
        if (business.ownerId !== user.id) {
          return NextResponse.json(
            { error: 'La transferencia de negocio no está permitida por este canal. Contacta a soporte.' },
            { status: 403 }
          );
        }
      } else {
        // 2. Reclamo de ticket térmico físico (QR del POS)
        const idempotencyKey = `claim_ticket_${claimId}`;

        // Buscar si hay una bóveda temporal vinculada al número de orden
        const [vault] = await db
          .select()
          .from(pendingVaults)
          .where(
            and(
              eq(pendingVaults.orderId, claimId),
              eq(pendingVaults.status, 'PENDING')
            )
          )
          .limit(1);

        // A ticket only represents the funds in an existing vault. Without a matching
        // PENDING vault there is nothing to award (no implicit free-mint fallback).
        if (vault) {
          // Posesión: el vault pertenece al teléfono del comprador (POS lo capturó)
          if (vault.phoneNumber) {
            const vaultDigits = vault.phoneNumber.replace(/\D/g, '').slice(-10);
            const userDigits = (user.phoneNumber || '').replace(/\D/g, '').slice(-10);
            if (vaultDigits && userDigits && vaultDigits !== userDigits) {
              return NextResponse.json({ error: 'Este ticket pertenece a otro teléfono. Pide el reclamo en la app con el QR del ticket.' }, { status: 403 });
            }
            if (vaultDigits && !userDigits) {
              return NextResponse.json({ error: 'Vincula tu teléfono en tu perfil (mismo del pedido) para reclamar este ticket.' }, { status: 403 });
            }
          }
          const bunzToAward = vault.bunzAmount;
          // branchId tiene FK a branches — vault.businessId es un negocio, no una branch
          const branchId: string | null = null;

          await db.transaction(async (tx) => {
            // Lock pesimista del vault: solo UN canal paga (bot o ticket, jamás ambos)
            const [lockedVault] = await tx
              .select()
              .from(pendingVaults)
              .where(eq(pendingVaults.id, vault.id))
              .for('update');
            if (!lockedVault || lockedVault.status !== 'PENDING') return;

            const [lockedUser] = await tx
              .select()
              .from(users)
              .where(eq(users.id, user.id))
              .for('update');

            if (!lockedUser) return;

            // Guard en-tx de AMBAS claves (el ticket usa pos_rwd_, el bot claim_ticket_)
            const prior = (await findLedgerEntry(idempotencyKey, tx)) ?? (await findLedgerEntry(`pos_rwd_${claimId}`, tx));
            if (prior) {
              await tx
                .update(pendingVaults)
                .set({ status: 'CLAIMED' })
                .where(and(eq(pendingVaults.id, vault.id), eq(pendingVaults.status, 'PENDING')));
              return;
            }

            // ECONOMÍA: el reclamo completa el mint — credita el stock del comercio
            if (vault.businessId) {
              await tx.update(ownedBusinesses)
                .set({ bunzBalance: sql`COALESCE("bunzBalance", 0) + ${bunzToAward}` })
                .where(eq(ownedBusinesses.id, vault.businessId));
            }

            await tx
              .update(users)
              .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzToAward}` })
              .where(eq(users.id, lockedUser.id));

            await tx
              .update(pendingVaults)
              .set({ status: 'CLAIMED' })
              .where(eq(pendingVaults.id, vault.id));

            await recordLedgerTransaction(
              {
                branchId,
                payerSubjectId: branchId || 'SYSTEM',
                payeeSubjectId: `usr_${user.id}`,
                amount: bunzToAward,
                type: 'EARN',
                referenceId: claimId,
                idempotencyKey,
                metadata: { orderNumber: claimId, reason: 'TICKET_QR_CLAIM', telegramId: user.telegramId },
              },
              tx
            );
          });
        }
      }
    }

    // Generate revocable session token for omnichannel compatibility
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await db.insert(webSessions).values({
      jwtToken: sessionToken,
      userId: user.id,
      expiresAt,
    });

    return NextResponse.json({ 
      success: true,
      isNewUser,
      sessionToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        tonWalletAddress: user.tonWalletAddress,
        totalBunzEarned: user.totalBunzEarned
      }
    });

  } catch (error) {
    console.error('Telegram Auth API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
