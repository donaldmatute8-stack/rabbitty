import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bunzyPreferences } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/**
 * ── Preferencias de Bunzy Connect (Rabbitters) ──
 * GET  → product/tips/news del usuario (defaults true).
 * POST → upsert. Los avisos de sistema no se pueden apagar.
 */
export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [pref] = await db
    .select()
    .from(bunzyPreferences)
    .where(and(eq(bunzyPreferences.recipientType, "USER"), eq(bunzyPreferences.recipientId, caller.id)))
    .limit(1);

  return NextResponse.json({
    success: true,
    product: pref?.product ?? true,
    tips: pref?.tips ?? true,
    news: pref?.news ?? true,
  });
}

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const values = {
    product: body.product !== false,
    tips: body.tips !== false,
    news: body.news !== false,
  };

  await db
    .insert(bunzyPreferences)
    .values({
      recipientType: "USER",
      recipientId: caller.id,
      ...values,
    })
    .onConflictDoUpdate({
      target: [bunzyPreferences.recipientType, bunzyPreferences.recipientId],
      set: { ...values, updatedAt: new Date() },
    });

  return NextResponse.json({ success: true, ...values });
}
