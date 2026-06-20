import { db } from '@/db';
import { users, levels, hatTricks, userHatTricks, achievements, userAchievements } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

    await db.update(users)
      .set({
        hops: sql`${users.hops} + ${hopsToAward}`,
        levelId: newLevelId,
      })
      .where(eq(users.id, userId));

    return { awardedHops: hopsToAward, newTotalHops: newTotalHops, newLevelId, leveledUp: newLevelId !== user.levelId };
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

      // Buscar si el usuario ya lo completó
      const userTrick = await db.query.userHatTricks.findFirst({
        where: and(eq(userHatTricks.userId, userId), eq(userHatTricks.trickId, trick.id))
      });

      if (userTrick?.isCompleted) {
        continue; // Ya lo completó
      }

      const newProgress = (userTrick?.progressValue || 0) + actionContext.value;
      const isNowCompleted = newProgress >= trick.conditionTarget;

      if (userTrick) {
        await db.update(userHatTricks)
          .set({ progressValue: newProgress, isCompleted: isNowCompleted, completedAt: isNowCompleted ? new Date() : null })
          .where(eq(userHatTricks.id, userTrick.id));
      } else {
        await db.insert(userHatTricks).values({
          userId,
          trickId: trick.id,
          progressValue: newProgress,
          isCompleted: isNowCompleted,
          completedAt: isNowCompleted ? new Date() : null
        });
      }

      // Si lo completó, dar recompensas
      if (isNowCompleted) {
        await db.update(users)
          .set({
            hops: sql`${users.hops} + ${trick.rewardHops}`,
            totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${trick.rewardBunz}`,
          })
          .where(eq(users.id, userId));
      }
    }
  } catch (error) {
    console.error('Error evaluating Hat Tricks:', error);
  }
}
