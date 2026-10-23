import { db } from '@/db';
import { users, hatTricks, userHatTricks } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';
import { sendEcosystemNotification } from '@/lib/push/notify';

/**
 * Otorgar Hops a un usuario y verificar si subió de nivel.
 */
export async function awardHops(userId: string, isNewBusiness: boolean) {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return;

    // Award +50 if new, +15 if recurrent
    const hopsToAward = isNewBusiness ? 50 : 15;
    const newTotalHops = user.hops + hopsToAward;

    // Check if level should increase
    const allLevels = await db.query.levels.findMany();
    // Sort levels by requiredHops desc so we find the highest qualifying level
    const sortedLevels = allLevels.sort((a, b) => b.requiredHops - a.requiredHops);
    
    let newLevelId = user.levelId;
    for (const lvl of sortedLevels) {
      if (newTotalHops >= lvl.requiredHops) {
        newLevelId = lvl.id;
        break; // highest qualifying
      }
    }

    const leveledUp = newLevelId !== user.levelId;

    await db.update(users)
      .set({
        hops: sql`${users.hops} + ${hopsToAward}`,
        levelId: newLevelId,
      })
      .where(eq(users.id, userId));

    if (leveledUp && newLevelId) {
      const reachedLevel = sortedLevels.find(l => l.id === newLevelId);
      const levelName = reachedLevel?.name || 'Nuevo Nivel';
      await sendEcosystemNotification({
        userId,
        title: `🏆 ¡Subiste al Nivel ${levelName}!`,
        message: `¡Tu Madriguera ha evolucionado! Con ${newTotalHops} Hops desbloqueaste un multiplicador de ${reachedLevel?.bunzMultiplier || 1}x en recompensas.`,
        type: 'MADRIGUERA',
        route: '/profile/gamification',
        pushData: { newLevelId, newTotalHops, levelName },
        threadId: 'gamification',
      });
    }

    return { awardedHops: hopsToAward, newTotalHops: newTotalHops, newLevelId, leveledUp };
  } catch (error) {
    console.error('Error awarding Hops:', error);
  }
}

/**
 * Evalúa los "Trucos del Sombrero" (Misiones) activos basados en una acción.
 * actionContext = { type: 'TOTAL_VISITS' | 'CATEGORY_VISITS' | 'REFERRALS_COUNT', value: 1, category?: string }
 */
export async function evaluateHatTricks(userId: string, actionContext: { type: string, value: number, category?: string }) {
  try {
    // Buscar misiones activas que coincidan con el tipo de acción
    const activeTricks = await db.query.hatTricks.findMany({
      where: eq(hatTricks.isActive, true)
    });

    const relevantTricks = activeTricks.filter(t => t.conditionType === actionContext.type);
    
    for (const trick of relevantTricks) {
      // Filtrar por categoría si aplica
      if (trick.conditionCategory && trick.conditionCategory !== actionContext.category) {
        continue;
      }

      await db.transaction(async (tx) => {
        // Lock/find userTrick
        const userTrick = await tx.query.userHatTricks.findFirst({
          where: and(eq(userHatTricks.userId, userId), eq(userHatTricks.trickId, trick.id))
        });

        if (userTrick?.isCompleted) {
          return; // Ya lo completó
        }

        const newProgress = (userTrick?.progressValue || 0) + actionContext.value;
        const isNowCompleted = newProgress >= trick.conditionTarget;

        if (userTrick) {
          await tx.update(userHatTricks)
            .set({ progressValue: newProgress, isCompleted: isNowCompleted, completedAt: isNowCompleted ? new Date() : null })
            .where(eq(userHatTricks.id, userTrick.id));
        } else {
          await tx.insert(userHatTricks).values({
            userId,
            trickId: trick.id,
            progressValue: newProgress,
            isCompleted: isNowCompleted,
            completedAt: isNowCompleted ? new Date() : null
          });
        }

        // Si lo completó, dar recompensas
        if (isNowCompleted) {
          // Lock user row
          const [userRow] = await tx
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
            .for('update');

          if (!userRow) return;

          await tx.update(users)
            .set({
              hops: sql`${users.hops} + ${trick.rewardHops}`,
              totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${trick.rewardBunz}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

          // Registrar en ledger si entrega Bunz (> 0)
          if (trick.rewardBunz > 0) {
            await recordLedgerTransaction(
              {
                payerSubjectId: 'sys_gamification',
                payeeSubjectId: `usr_${userId}`,
                amount: trick.rewardBunz,
                type: 'EARN',
                referenceId: trick.id,
                idempotencyKey: `hat_trick_${userId}_${trick.id}`,
                metadata: {
                  trickTitle: trick.title,
                  rewardHops: trick.rewardHops,
                  source: 'gamification_hat_tricks',
                },
              },
              tx
            );
          }

          // Notificar al usuario misión completada
          await sendEcosystemNotification({
            userId,
            title: `🎩 ¡Misión Completada: ${trick.title}!`,
            message: `Ganaste +${trick.rewardHops} Hops${trick.rewardBunz > 0 ? ` y ${trick.rewardBunz} Bunz` : ''}. ¡Sigue conquistando la ciudad!`,
            type: 'HOPS',
            route: '/profile/gamification',
            pushData: { trickId: trick.id, rewardHops: trick.rewardHops, rewardBunz: trick.rewardBunz },
            threadId: 'missions',
          });
        }
      });
    }
  } catch (error) {
    console.error('Error evaluating Hat Tricks:', error);
  }
}
