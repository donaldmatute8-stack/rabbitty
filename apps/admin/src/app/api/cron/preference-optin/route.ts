import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getCoreDb } from "@rabbitty/api/db";
import {
  notificationsOutbox,
  ownedBusinesses,
  userPreferences,
  users,
} from "@rabbitty/database-core";
import { canSendEngagement } from "@rabbitty/api/services/notificationPacing";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/preference-optin ── pedir el opt-in de favoritos ──────────────
 *
 * No se manda a todos de golpe. Se pide una sola vez, y solo cuando:
 *   · el Rabbitter ya tiene un favorito confiable (≥3 señales, score ≥0.25)
 *   · volvió hace poco (últimos 45 días) → no es un aviso en frío
 *   · su cuenta tiene al menos 2 días (los nuevos reciben onboarding escalonado)
 *   · no ha recibido NINGÚN aviso de engagement en 72 h
 *   · no se le pidió antes (dedupe por usuario)
 *
 * La notificación abre Ajustes → Notificaciones, donde está el toggle.
 */

const MIN_SCORE = 0.25;
const MIN_SIGNALS = 3;
const MIN_ACCOUNT_DAYS = 2;
const ACTIVE_DAYS = 45;
const PACING_HOURS = 72;
const MAX_PER_RUN = 100;

function authorize(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer /, "").trim();
  return Boolean(CRON_SECRET && auth === CRON_SECRET);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const coreDb = getCoreDb();
    const sinceActivity = new Date(Date.now() - ACTIVE_DAYS * 86_400_000);
    const minCreated = new Date(Date.now() - MIN_ACCOUNT_DAYS * 86_400_000);

    const candidates = await coreDb
      .select({
        userId: userPreferences.userId,
        businessId: userPreferences.businessId,
        label: userPreferences.label,
        score: userPreferences.score,
        lastSeenAt: userPreferences.lastSeenAt,
        businessName: ownedBusinesses.name,
        pushRules: users.pushRules,
        muted: users.pushMutedCategories,
        userCreatedAt: users.createdAt,
      })
      .from(userPreferences)
      .innerJoin(users, eq(users.id, userPreferences.userId))
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, userPreferences.businessId))
      .where(
        and(
          eq(userPreferences.kind, "PRODUCT"),
          gte(userPreferences.score, MIN_SCORE),
          gte(userPreferences.signalCount, MIN_SIGNALS),
          gte(userPreferences.lastSeenAt, sinceActivity),
          lte(users.createdAt, minCreated),
        ),
      )
      .orderBy(desc(userPreferences.score))
      .limit(400);

    let sent = 0;
    const skipped = { alreadyOptIn: 0, muted: 0, pacing: 0, requested: 0, duplicateBusiness: 0 };
    const seenUsers = new Set<string>();

    for (const c of candidates) {
      if (sent >= MAX_PER_RUN) break;
      if (!c.businessId) continue;

      const rules = parseJson<Record<string, boolean>>(c.pushRules, {});
      if (rules.favoriteAlerts === true) { skipped.alreadyOptIn += 1; continue; }

      const muted = parseJson<string[]>(c.muted, []);
      if (muted.includes("favorites")) { skipped.muted += 1; continue; }

      // Un solo recordatorio por usuario (no por negocio)
      if (seenUsers.has(c.userId)) { skipped.duplicateBusiness += 1; continue; }

      const dedupeKey = `pref_optin:${c.userId}`;
      const [prior] = await coreDb
        .select({ id: notificationsOutbox.id })
        .from(notificationsOutbox)
        .where(eq(notificationsOutbox.dedupeKey, dedupeKey))
        .limit(1);
      if (prior) { skipped.requested += 1; continue; }

      const canSend = await canSendEngagement(coreDb, c.userId, PACING_HOURS);
      if (!canSend) { skipped.pacing += 1; continue; }

      await coreDb
        .insert(notificationsOutbox)
        .values({
          userId: c.userId,
          type: "PREFERENCE_OPTIN",
          title: "¿Te avisamos cuando te alcance?",
          message: `Vimos que sueles pedir ${c.label} en ${c.businessName ?? "tu lugar"}. Si quieres, Bunzy te avisa cuando tus Bunz alcancen para eso. Tú decides.`,
          route: "/settings?section=notifications",
          data: { businessId: c.businessId, product: c.label, kind: "favorite_optin" },
          dedupeKey,
          priority: "normal",
        })
        .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });

      seenUsers.add(c.userId);
      sent += 1;
    }

    return NextResponse.json({ success: true, candidates: candidates.length, sent, skipped });
  } catch (error) {
    console.error("[PREFERENCE_OPTIN]", error);
    return NextResponse.json({ success: false, error: "No se pudo pedir el opt-in" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, hint: "POST para pedir el opt-in de favoritos" });
}
