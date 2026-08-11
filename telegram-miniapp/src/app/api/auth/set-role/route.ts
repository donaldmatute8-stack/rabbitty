import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseTelegramUser, validateTelegramInitData } from "@/lib/telegramAuth";
import { z } from "zod";

const bodySchema = z.object({
  role: z.enum(["USER", "AFFILIATE"]),
  initData: z.string().optional(),
  telegramId: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de entrada inválidos." }, { status: 400 });
    }

    const { role, initData } = parsed.data;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    let telegramId: string | null = null;

    if (initData) {
      if (botToken && !validateTelegramInitData(initData, botToken)) {
        return NextResponse.json({ error: "initData inválido" }, { status: 401 });
      }
      const tgUser = parseTelegramUser(initData);
      if (tgUser?.id) {
        telegramId = tgUser.id.toString();
      }
    }

    // Fallback solo en desarrollo (sin TELEGRAM_BOT_TOKEN configurado).
    // En producción la identidad SIEMPRE se deriva del initData validado.
    if (!telegramId && !botToken && typeof parsed.data.telegramId === "string") {
      telegramId = parsed.data.telegramId;
    }

    if (!telegramId) {
      return NextResponse.json({ error: "No se pudo identificar al usuario." }, { status: 401 });
    }

    const [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.telegramId, telegramId))
      .returning();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("[SET_ROLE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
