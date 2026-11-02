import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { PUSH_CATEGORY_LIST, PUSH_CATEGORY_LABELS, parseMutedCategories } from "@/lib/push/categories";

/**
 * ── Preferencias de push por categoría (v2.1 §2.2/§2.3) ──
 * GET  → categorías silenciadas + catálogo completo con labels (para settings).
 * POST { muted: string[] } → reemplaza el set. Solo acepta categorías del
 * catálogo; CRITICAL/SYSTEM no son categorías y nunca se podemos silenciar.
 */
export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [row] = await db
    .select({ muted: users.pushMutedCategories })
    .from(users)
    .where(eq(users.id, caller.id))
    .limit(1);
  const muted = parseMutedCategories(row?.muted);
  return NextResponse.json({
    ok: true,
    muted,
    categories: PUSH_CATEGORY_LIST.map((key) => ({ key, ...PUSH_CATEGORY_LABELS[key] })),
  });
}

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const incoming = Array.isArray(body?.muted) ? body.muted : null;
  if (!incoming) return NextResponse.json({ error: "muted (array) requerido" }, { status: 400 });

  // Solo categorías válidas del catálogo (jamás tipos sueltos)
  const muted = PUSH_CATEGORY_LIST.filter((cat) => incoming.includes(cat));

  await db
    .update(users)
    .set({ pushMutedCategories: JSON.stringify(muted), updatedAt: new Date() })
    .where(eq(users.id, caller.id));

  return NextResponse.json({ ok: true, muted });
}
