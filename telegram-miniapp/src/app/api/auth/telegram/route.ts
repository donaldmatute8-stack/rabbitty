import { NextResponse } from 'next/server';
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegramAuth';
import { resolveUniqueUsername } from '@/lib/username';
import { db } from '@/db';
import { users, referrals, webSessions, ownedBusinesses, pendingVaults } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
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

    // Manejo de códigos promocionales de carteles / impresos (ej. promo_626cafe)
    if (startParam && startParam.startsWith('promo_')) {
      const promoBusinessSlug = startParam.replace('promo_', '').trim().toLowerCase();

      // Blindaje de seguridad: Solo usuarios nuevos o sin bono previo pueden recibirlo (1 sola vez de por vida)
      const idempotencyKey = `promo_welcome_${promoBusinessSlug}_${user.id}`;
      const priorBonus = await findLedgerEntry(idempotencyKey);

      if (!priorBonus && isNewUser) {
        // Buscar el negocio afiliado emisor
        const [promoBiz] = await db
          .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, rewardPercentage: ownedBusinesses.rewardPercentage })
          .from(ownedBusinesses)
          .where(
            or(
              eq(sql`LOWER(REPLACE(${ownedBusinesses.name}, ' ', ''))`, promoBusinessSlug),
              eq(sql`LOWER(COALESCE(slug, ''))`, promoBusinessSlug),
              eq(sql`SUBSTRING(${ownedBusinesses.id}::text, 1, 8)`, promoBusinessSlug)
            )
          )
          .limit(1);

        const bonusBunz = promoBiz?.rewardPercentage || 25;

        await db.transaction(async (tx) => {
          const [lockedUser] = await tx
            .select()
            .from(users)
            .where(eq(users.id, user.id))
            .for('update');

          if (!lockedUser) return;

          const recheck = await findLedgerEntry(idempotencyKey, tx);
          if (recheck) return;

          await tx
            .update(users)
            .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bonusBunz}` })
            .where(eq(users.id, lockedUser.id));

          await recordLedgerTransaction(
            {
              payerSubjectId: promoBiz?.id || 'sys_promo_welcome',
              payeeSubjectId: `usr_${user.id}`,
              amount: bonusBunz,
              type: 'EARN',
              referenceId: promoBusinessSlug,
              idempotencyKey,
              metadata: {
                reason: 'PROMO_WELCOME_PRINT_KIT',
                businessName: promoBiz?.name || promoBusinessSlug,
                ref: promoBusinessSlug,
                telegramId: user.telegramId,
              },
            },
            tx
          );
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
        const bId = business.id;
        // Ownership transfer is a privileged operation. A public start-param must
        // never reassign an arbitrary business; only an ADMIN may transfer ownership.
        if (business.ownerId !== user.id) {
          if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado para reclamar este negocio' }, { status: 403 });
          }
          await db.execute(
            sql`UPDATE "ownedBusinesses" SET "ownerId" = ${user.id} WHERE id = ${bId}`
          );
          console.log(`[Claim Business] Negocio ${bId} transferido por admin ${user.id}`);
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
          const bunzToAward = vault.bunzAmount;
          const branchId = vault.businessId || null;

          await db.transaction(async (tx) => {
            const [lockedUser] = await tx
              .select()
              .from(users)
              .where(eq(users.id, user.id))
              .for('update');

            if (!lockedUser) return;

            const prior = await findLedgerEntry(idempotencyKey, tx);
            if (prior) return;

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
