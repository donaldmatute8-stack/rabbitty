import { db } from '@/db';
import { users, referrals, notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Triggers the referral reward for the inviter if this is the invited user's first consumption/earn.
 * Also sends the appropriate notifications.
 */
export async function processReferralAndNotifications(userId: string, type: 'EARN' | 'SPEND') {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) return;

    let updated = false;
    let shouldTriggerReferral = false;

    // Check First Earn
    if (type === 'EARN' && !user.hasEarnedFirstBunz) {
      await db.update(users).set({ hasEarnedFirstBunz: true }).where(eq(users.id, userId));
      
      await db.insert(notifications).values({
        userId,
        title: '¡Tus primeros Bunz!',
        message: 'Felicidades por recibir tus primeros Bunz. Sigue descubriendo lugares en la ciudad.',
        type: 'REWARD'
      });
      
      shouldTriggerReferral = true;
      updated = true;
    }

    // Check First Spend
    if (type === 'SPEND' && !user.hasMadeFirstTransaction) {
      await db.update(users).set({ hasMadeFirstTransaction: true }).where(eq(users.id, userId));
      
      await db.insert(notifications).values({
        userId,
        title: '¡Tu primer canje!',
        message: 'Felicidades por realizar tu primera reservación. ¡Disfruta tu recompensa!',
        type: 'REWARD'
      });
      
      shouldTriggerReferral = true;
      updated = true;
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
        // Mark as completed
        await db.update(referrals).set({ status: 'COMPLETED' }).where(eq(referrals.id, referral.id));

        // Reward inviter
        const inviter = await db.query.users.findFirst({
          where: eq(users.id, referral.inviterId)
        });

        if (inviter) {
          await db.update(users)
            .set({ totalBunzEarned: inviter.totalBunzEarned + referral.rewardAmount })
            .where(eq(users.id, inviter.id));

          // Notify inviter
          await db.insert(notifications).values({
            userId: inviter.id,
            title: '¡Bono de referido!',
            message: `Acabas de ganar ${referral.rewardAmount} Bunz porque tu amigo ${user.firstName || 'invitado'} hizo su primer consumo.`,
            type: 'REFERRAL'
          });
        }
      }
    }
  } catch (err) {
    console.error('Error processing referral logic:', err);
  }
}
