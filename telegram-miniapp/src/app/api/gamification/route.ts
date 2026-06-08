import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, levels, achievements, userAchievements, hatTricks, userHatTricks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Nivel
    let currentLevel = null;
    if (user.levelId) {
      currentLevel = await db.query.levels.findFirst({ where: eq(levels.id, user.levelId) });
    }

    // Insignias Totales y las del usuario
    const allAchievements = await db.query.achievements.findMany();
    const userAchvs = await db.query.userAchievements.findMany({
      where: eq(userAchievements.userId, userId)
    });
    
    const unlockedIds = userAchvs.map(ua => ua.achievementId);
    
    const achievementsData = allAchievements.map(ach => ({
      ...ach,
      unlocked: unlockedIds.includes(ach.id),
      unlockedAt: userAchvs.find(ua => ua.achievementId === ach.id)?.unlockedAt || null
    }));

    // Misiones activas y el progreso del usuario
    const activeTricks = await db.query.hatTricks.findMany({
      where: eq(hatTricks.isActive, true)
    });
    const userTricks = await db.query.userHatTricks.findMany({
      where: eq(userHatTricks.userId, userId)
    });

    const missionsData = activeTricks.map(trick => {
      const ut = userTricks.find(ut => ut.trickId === trick.id);
      return {
        ...trick,
        progressValue: ut?.progressValue || 0,
        isCompleted: ut?.isCompleted || false
      };
    });

    return NextResponse.json({
      success: true,
      hops: user.hops,
      level: currentLevel,
      achievements: achievementsData,
      missions: missionsData
    });
  } catch (error) {
    console.error("GET gamification error:", error);
    return NextResponse.json({ error: "Error al obtener datos de gamificación" }, { status: 500 });
  }
}
