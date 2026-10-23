import { db } from '@/db';
import { users, referrals, notifications } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';
import { sendEcosystemNotification } from '@/lib/push/notify';

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

    let shouldTriggerReferral = false;

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
      
      shouldTriggerReferral = true;
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
      
      shouldTriggerReferral = true;
    }

    // Trigger Referral Reward
    if (shouldTriggerReferral) {
      // Find pending referral
      const referral = await db.query.referrals.findFirst({
        where: and(
          eq(referrals.invitedId, userId),
          eq(referrals.status, 'PENDING')
        )
      });

      if (referral) {
        await db.transaction(async (tx) => {
          // Re-verify and lock referral
          const [lockedReferral] = await tx
            .select()
            .from(referrals)
            .where(and(eq(referrals.id, referral.id), eq(referrals.status, 'PENDING')))
            .limit(1)
            .for('update');

          if (!lockedReferral) return;

          // Lock inviter user row
          const [inviter] = await tx
            .select()
            .from(users)
            .where(eq(users.id, lockedReferral.inviterId))
            .limit(1)
            .for('update');

          if (!inviter) return;

          // 1. Mark referral as completed
          await tx
            .update(referrals)
            .set({ status: 'COMPLETED' })
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
          await recordLedgerTransaction(
            {
              payerSubjectId: 'sys_referrals',
              payeeSubjectId: `usr_${inviter.id}`,
              amount: lockedReferral.rewardAmount,
              type: 'EARN',
              referenceId: lockedReferral.id,
              idempotencyKey: `ref_reward_${lockedReferral.id}`,
              metadata: {
                invitedUserId: userId,
                invitedUsername: user.username || user.firstName || 'Invitado',
                source: 'referral_program',
              },
            },
            tx
          );

          // 4. Notify inviter (in-app)
          await tx.insert(notifications).values({
            userId: inviter.id,
            title: '¡Bono de referido! 🎁',
            message: `Acabas de ganar ${lockedReferral.rewardAmount} Bunz porque tu amigo ${user.firstName || 'invitado'} hizo su primer consumo.`,
            type: 'REFERRAL',
          });
        });

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
      }
    }
  } catch (err) {
    console.error('Error processing referral logic:', err);
  }
}
