import { prisma } from "@/lib/prisma";

/**
 * Checks and unlocks achievements for a user based on their transaction history.
 * Should be called after a successful transaction.
 */
export async function checkAchievements(profileId: string) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        transactions: { where: { status: 'APPROVED' } },
        achievements: true
      }
    });

    if (!profile) return;

    const approvedTxCount = profile.transactions.length;

    // Get all achievements
    const allAchievements = await prisma.achievement.findMany();

    // Find which ones the user hasn't unlocked yet but meets the target
    for (const ach of allAchievements) {
      const alreadyUnlocked = profile.achievements.some(pa => pa.achievementId === ach.id);
      
      if (!alreadyUnlocked && approvedTxCount >= ach.target_value) {
        // Unlock it
        await prisma.profileAchievement.create({
          data: {
            profileId: profile.id,
            achievementId: ach.id
          }
        });

        // Grant reward if any
        if (ach.bunz_reward > 0) {
          await prisma.profile.update({
            where: { id: profile.id },
            data: { bunz_balance: { increment: ach.bunz_reward } }
          });
        }

        // Notify user
        await prisma.notification.create({
          data: {
            profileId: profile.id,
            title: "¡Logro Desbloqueado!",
            message: `Has desbloqueado: ${ach.title}. ${ach.bunz_reward > 0 ? `Ganaste ${ach.bunz_reward} Bunz.` : ''}`,
            type: "SUCCESS"
          }
        });
      }
    }
    
    // Level up logic (e.g. every 5 transactions = 1 level)
    const newLevel = Math.floor(approvedTxCount / 5) + 1;
    if (newLevel > profile.level) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { level: newLevel }
      });
      
      // Notify Level Up
      await prisma.notification.create({
        data: {
          profileId: profile.id,
          title: "¡Subiste de Nivel!",
          message: `¡Felicidades! Ahora eres nivel ${newLevel}. Tus Bunz pendientes podrían estar disponibles pronto.`,
          type: "INFO"
        }
      });
    }

  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}
