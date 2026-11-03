import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { PUSH_CATEGORY_LIST, PUSH_CATEGORY_LABELS, PUSH_RULE_KEYS, PUSH_RULE_LABELS, parseMutedCategories, parsePushRules } from "@/lib/push/categories";

/**
 * ── Preferencias de push por categoría (v2.1 §2.2/§2.3) ──
 * GET  → categorías silenciadas + catálogo completo con labels (para settings).
 * POST { muted: string[] } → reemplaza el set. Solo acepta categorías del
 * catálogo; CRITICAL/SYSTEM no son categorías y nunca se podemos silenciar.
 */
function parseRulesSafe(raw: string): Record<string, boolean> {
  try { return JSON.parse(raw) as Record<string, boolean>; } catch { return {}; }
}

export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [row] = await db
    .select({ muted: users.pushMutedCategories, rules: users.pushRules, inAppEnabled: users.pushInAppEnabled })
    .from(users)
    .where(eq(users.id, caller.id))
    .limit(1);
  const muted = parseMutedCategories(row?.muted);
  const rules = parsePushRules(row?.rules);
  return NextResponse.json({
    ok: true,
    muted,
    rules,
    // H22 · plano CANAL: false = sin campana, pero el push nativo sí llega.
    inAppEnabled: row?.inAppEnabled !== false,
    categories: PUSH_CATEGORY_LIST.map((key) => ({ key, ...PUSH_CATEGORY_LABELS[key] })),
    ruleCatalog: PUSH_RULE_KEYS.map((key) => ({ key, ...PUSH_RULE_LABELS[key] })),
  });
}

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const hasMuted = Array.isArray(body?.muted);
  const hasInApp = typeof body?.inAppEnabled === "boolean";
  const hasRules = body?.rules && typeof body.rules === "object";
  if (!hasMuted && !hasInApp && !hasRules) {
    return NextResponse.json(
      { error: "muted (array), inAppEnabled (boolean) o rules (object) requerido" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };

  // Plano CATEGORÍA: solo categorías válidas del catálogo (jamás tipos sueltos)
  let muted: string[] | undefined;
  if (hasMuted) {
    muted = PUSH_CATEGORY_LIST.filter((cat) => body.muted.includes(cat));
    update.pushMutedCategories = JSON.stringify(muted);
  }

  // Plano CANAL (H22): campana in-app on/off. Apagarla NO apaga el push nativo.
  if (hasInApp) {
    update.pushInAppEnabled = body.inAppEnabled;
  }

  if (hasRules) {
    // Solo keys del catálogo de reglas — Merengue jamás acepta reglas de types sueltos
    update.pushRules = JSON.stringify(Object.fromEntries(
      PUSH_RULE_KEYS.map((key) => [key, (body.rules as Record<string, unknown>)[key] === true]),
    ));
  }
  await db.update(users).set(update).where(eq(users.id, caller.id));

  return NextResponse.json({
    ok: true,
    muted,
    inAppEnabled: hasInApp ? body.inAppEnabled : undefined,
    rules: update.pushRules ? parseRulesSafe(String(update.pushRules)) : undefined,
  });
}
