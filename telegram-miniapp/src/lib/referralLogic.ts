import { db } from '@/db';
import { users, referrals, notifications } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';
import { sendEcosystemNotification } from '@/lib/push/notify';
import { GROWTH_FUND_ACCOUNT, growthFundFlags } from '@rabbitty/api/services/growthFund';

/**
 * Triggers the referral reward for the inviter if this is the invited user's first consumption/earn.
 * Also sends the appropriate notifications and writes to the authoritative ledger.
 */
export async function processReferralAndNotifications(userId: string, type: 'EARN' | 'SPEND') {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) return;

    // Check First Earn
    if (type === 'EARN' && !user.hasEarnedFirstBunz) {
      await db.update(users).set({ hasEarnedFirstBunz: true }).where(eq(users.id, userId));
      
      await sendEcosystemNotification({
        userId,
        title: '🌟 ¡Tus primeros Bunz!',
        message: '¡Felicidades por recibir tus primeros Bunz! Sigue descubriendo lugares en Rabbitty.',
        type: 'REWARD',
        route: '/profile/wallet',
        threadId: 'first_milestones',
      });
    }

    // Check First Spend
    if (type === 'SPEND' && !user.hasMadeFirstTransaction) {
      await db.update(users).set({ hasMadeFirstTransaction: true }).where(eq(users.id, userId));
      
      await sendEcosystemNotification({
        userId,
        title: '🎟️ ¡Tu primer canje!',
        message: '¡Felicidades por tu primera reservación! Disfruta tu beneficio en el negocio.',
        type: 'REWARD',
        route: '/profile/inventory',
        threadId: 'first_milestones',
      });
    }

    // Trigger Referral Reward.
    // Se intenta en cada EARN/SPEND (no solo en el primero) para que un bono
    // QUEUED por fondo insuficiente pueda pagarse en un evento posterior.
    const eligibleForReferral = Boolean(user.hasEarnedFirstBunz || user.hasMadeFirstTransaction) ||
      type === 'EARN' || type === 'SPEND';

    if (eligibleForReferral) {
      const referral = await db.query.referrals.findFirst({
        where: and(
          eq(referrals.invitedId, userId),
          eq(referrals.status, 'PENDING')
        )
      });

      if (referral) {
        const flags = growthFundFlags();
        const payout = await db.transaction(async (tx) => {
          // Re-verify and lock referral
          const [lockedReferral] = await tx
            .select()
            .from(referrals)
            .where(and(eq(referrals.id, referral.id), eq(referrals.status, 'PENDING')))
            .limit(1)
            .for('update');

          if (!lockedReferral) return { paid: false as const, reason: 'ALREADY' };

          // Lock inviter user row
          const [inviter] = await tx
            .select()
            .from(users)
            .where(eq(users.id, lockedReferral.inviterId))
            .limit(1)
            .for('update');

          if (!inviter) return { paid: false as const, reason: 'NO_INVITER' };

          let payerSubjectId = 'sys_referrals';
          let idempotencyKey = `ref_reward_${lockedReferral.id}`;
          let ledgerEntryId: string | null = null;

          if (flags.referralPayouts) {
            // Fondo único: serializa pagos para no sobregirar el saldo.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${GROWTH_FUND_ACCOUNT}))`);
            const [balanceRow] = (await tx.execute(sql`
              SELECT
                COALESCE(SUM(CASE WHEN "payeeSubjectId" = ${GROWTH_FUND_ACCOUNT}
                                   AND type IN ('MINT','TRANSFER') THEN amount ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN "payerSubjectId" = ${GROWTH_FUND_ACCOUNT}
                                   AND type = 'EARN' THEN amount ELSE 0 END), 0) AS balance
                FROM "ledger_entries"
               WHERE "payerSubjectId" = ${GROWTH_FUND_ACCOUNT}
                  OR "payeeSubjectId" = ${GROWTH_FUND_ACCOUNT}
            `)).rows as Array<{ balance: number }>;

            if (Number(balanceRow?.balance ?? 0) < lockedReferral.rewardAmount) {
              // No se marca COMPLETED: queda PENDING para el próximo evento.
              return { paid: false as const, reason: 'QUEUED' };
            }

            payerSubjectId = GROWTH_FUND_ACCOUNT;
            idempotencyKey = `referral_reward:${lockedReferral.id}:1`;
          }

          // 1. Mark referral as completed
          await tx
            .update(referrals)
            .set({
              status: 'COMPLETED',
              rewardedAt: new Date(),
              tranchesPaid: 1,
            })
            .where(eq(referrals.id, lockedReferral.id));

          // 2. Credit inviter user
          await tx
            .update(users)
            .set({
              totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${lockedReferral.rewardAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, inviter.id));

          // 3. Record authoritative ledger entry
          const entry = await recordLedgerTransaction(
            {
              payerSubjectId,
              payeeSubjectId: `usr_${inviter.id}`,
              amount: lockedReferral.rewardAmount,
              type: 'EARN',
              referenceId: lockedReferral.id,
              idempotencyKey,
              metadata: {
                invitedUserId: userId,
                invitedUsername: user.username || user.firstName || 'Invitado',
                source: flags.referralPayouts ? 'madriguera_referral' : 'referral_program',
                program: flags.referralPayouts ? 'madriguera' : undefined,
              },
            },
            tx
          );
          ledgerEntryId = entry?.id ?? null;

          await tx
            .update(referrals)
            .set({ ledgerEntryId })
            .where(eq(referrals.id, lockedReferral.id));

          // 4. Notify inviter (in-app)
          await tx.insert(notifications).values({
            userId: inviter.id,
            title: '¡Bono de referido! 🎁',
            message: `Acabas de ganar ${lockedReferral.rewardAmount} Bunz porque tu amigo ${user.firstName || 'invitado'} hizo su primer consumo.`,
            type: 'REFERRAL',
          });

          return { paid: true as const, amount: lockedReferral.rewardAmount };
        });

        if (payout.paid) {
          // 5. Native push al invitador
          await sendEcosystemNotification({
            userId: referral.inviterId,
            title: '🎁 ¡Bono de referido recibido!',
            message: `¡Ganaste ${referral.rewardAmount} Bunz! Tu amigo ${user.firstName || 'invitado'} realizó su primer consumo en Rabbitty.`,
            type: 'REFERRAL',
            route: '/referral',
            pushData: { rewardAmount: referral.rewardAmount, invitedUserId: userId },
            threadId: 'referrals',
          });
        } else if (payout.reason === 'QUEUED') {
          console.info(`[REFERRAL_QUEUED] referral=${referral.id} fondo sin saldo`);
        }
      }
    }
  } catch (err) {
    console.error('Error processing referral logic:', err);
  }
}
