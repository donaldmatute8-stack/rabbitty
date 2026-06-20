import { NextRequest, NextResponse } from "next/server";
import { sql, eq } from "drizzle-orm";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { customers } from "@rabbitty/database-restaurant/schema";
import { users, notifications } from "@rabbitty/database-core";
import { miniappClient } from "@rabbitty/api/services/miniapp-client";

const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_BUNZ = 100;

export async function GET(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantDb = getRestaurantDb();
  const coreDb = getCoreDb();

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const birthdayCustomers = await restaurantDb.select().from(customers).where(
    sql`EXTRACT(MONTH FROM ${customers.birthDate}) = ${todayMonth} AND EXTRACT(DAY FROM ${customers.birthDate}) = ${todayDay}`
  );

  const rewarded: { name: string | null; phone: string; bunz: number }[] = [];
  const errors: { phone: string; error: string }[] = [];
  const bonusBunz = DEFAULT_BUNZ;

  for (const customer of birthdayCustomers) {
    try {
      const user = await lookupUserByPhone(coreDb, customer.phone);
      if (!user) {
        errors.push({ phone: customer.phone, error: "User not found in core DB" });
        continue;
      }

      await coreDb.update(users)
        .set({ totalBunzEarned: sql`${users.totalBunzEarned} + ${bonusBunz}` })
        .where(eq(users.id, user.id));

      await coreDb.insert(notifications).values({
        userId: user.id,
        title: "¡Feliz Cumpleaños! 🎂",
        message: `Hoy celebramos tu día. Recibiste ${bonusBunz} Bunz de regalo. ¡Disfrútalos!`,
        type: "BONUS",
      });

      try {
        if (user.telegramId) {
          await miniappClient.sendNotification({
            userId: user.id,
            title: "¡Feliz Cumpleaños! 🎂",
            message: `Hoy celebramos tu día. Te hemos acreditado ${bonusBunz} Bunz. ¡Disfrútalos en cualquier negocio afiliado!`,
            type: "BONUS",
          });
        }
      } catch {
        // Notification non-critical
      }

      rewarded.push({ name: customer.name, phone: customer.phone, bunz: bonusBunz });
    } catch (err) {
      errors.push({ phone: customer.phone, error: String(err) });
    }
  }

  return NextResponse.json({
    checked: true,
    birthdayCount: birthdayCustomers.length,
    rewarded: rewarded.length,
    bunzDistributed: rewarded.length * bonusBunz,
    rewardedCustomers: rewarded,
    errors,
  });
}

async function lookupUserByPhone(coreDb: ReturnType<typeof getCoreDb>, phone: string) {
  const [user] = await coreDb.select().from(users).where(eq(users.phoneNumber, phone));
  return user || null;
}
