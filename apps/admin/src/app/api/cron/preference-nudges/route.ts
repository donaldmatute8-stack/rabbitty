import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { menuItems } from "@rabbitty/database-restaurant/schema";
import {
  notificationsOutbox,
  ownedBusinesses,
  preferenceNudges,
  userPreferences,
  users,
} from "@rabbitty/database-core";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/preference-nudges ── "Bunzy: ya te alcanza" (Fase 2)
 *
 * Reglas (todas obligatorias):
 *   · opt-in explícito del usuario (`pushRules.favoriteAlerts === true`)
 *   · categoría `favorites` no silenciada
 *   · saldo >= precio del favorito × 1.05
 *   · producto activo y disponible
 *   · sin avisos de ese favorito en 72 h
 *   · máximo 3 avisos por semana por usuario
 *   · fuera de horario de silencio (21:00–09:00, hora de México)
 *   · negocio aprobado/verificado
 *
 * Encola en `notifications_outbox` (dedupe diario) y registra en
 * `preference_nudges` para medir apertura/conversión y aplicar anti-spam.
 */

const QUIET_START = 21;
const QUIET_END = 9;
const PER_FAVORITE_HOURS = 72;
const WEEKLY_CAP = 3;
const BALANCE_MARGIN = 1.05;
const MIN_SCORE = 0.25;
const MIN_SIGNALS = 3;

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

function hourInMexico(): number {
  const h = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const n = Number(h);
  return Number.isFinite(n) ? n % 24 : new Date().getHours();
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const hour = hourInMexico();
  if (hour >= QUIET_START || hour < QUIET_END) {
    return NextResponse.json({ success: true, skipped: "quiet-hours", hour });
  }

  try {
    const coreDb = getCoreDb();
    const restaurantDb = getRestaurantDb();

    const prefs = await coreDb
      .select({
        id: userPreferences.id,
        userId: userPreferences.userId,
        businessId: userPreferences.businessId,
        refId: userPreferences.refId,
        label: userPreferences.label,
        businessName: ownedBusinesses.name,
        balance: sql<number>`GREATEST(0, COALESCE(${users.totalBunzEarned}, 0) - COALESCE(${users.totalBunzSpent}, 0))`,
        pushRules: users.pushRules,
        muted: users.pushMutedCategories,
      })
      .from(userPreferences)
      .innerJoin(users, eq(users.id, userPreferences.userId))
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, userPreferences.businessId))
      .where(
        and(
          eq(userPreferences.kind, "PRODUCT"),
          gte(userPreferences.score, MIN_SCORE),
          gte(userPreferences.signalCount, MIN_SIGNALS),
          inArray(ownedBusinesses.status, ["APPROVED", "VERIFIED"]),
        ),
      )
      .limit(500);

    if (prefs.length === 0) return NextResponse.json({ success: true, candidates: 0, sent: 0 });

    // Precio y disponibilidad actual del producto
    const productIds = [...new Set(prefs.map((p) => p.refId))];
    const items = await restaurantDb
      .select({
        id: menuItems.id,
        price: menuItems.price,
        isActive: menuItems.isActive,
        isAvailable: menuItems.isAvailable,
      })
      .from(menuItems)
      .where(inArray(menuItems.id, productIds));
    const itemById = new Map(items.map((i) => [i.id, i]));

    const now = Date.now();
    const since72 = new Date(now - PER_FAVORITE_HOURS * 3_600_000);
    const since7 = new Date(now - 7 * 86_400_000);

    const recentPerPref = await coreDb
      .select({ preferenceId: preferenceNudges.preferenceId })
      .from(preferenceNudges)
      .where(gte(preferenceNudges.sentAt, since72));
    const blockedPrefs = new Set(recentPerPref.map((r) => r.preferenceId));

    const weekly = await coreDb
      .select({
        userId: preferenceNudges.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(preferenceNudges)
      .where(gte(preferenceNudges.sentAt, since7))
      .groupBy(preferenceNudges.userId);
    const weeklyByUser = new Map(weekly.map((w) => [w.userId, Number(w.count)]));

    const dateKey = new Date().toISOString().slice(0, 10);
    let sent = 0;
    const skipped = { noOptIn: 0, muted: 0, notEnough: 0, unavailable: 0, frequent: 0, weeklyCap: 0 };

    for (const p of prefs) {
      if (!p.businessId) continue;

      const rules = parseJson<Record<string, boolean>>(p.pushRules, {});
      if (rules.favoriteAlerts !== true) { skipped.noOptIn += 1; continue; }

      const muted = parseJson<string[]>(p.muted, []);
      if (muted.includes("favorites")) { skipped.muted += 1; continue; }

      const item = itemById.get(p.refId);
      if (!item || !item.isActive || !item.isAvailable) { skipped.unavailable += 1; continue; }

      const price = Number(item.price ?? 0);
      const balance = Number(p.balance ?? 0);
      if (price <= 0 || balance < price * BALANCE_MARGIN) { skipped.notEnough += 1; continue; }

      if (blockedPrefs.has(p.id)) { skipped.frequent += 1; continue; }
      if ((weeklyByUser.get(p.userId) ?? 0) >= WEEKLY_CAP) { skipped.weeklyCap += 1; continue; }

      const dedupeKey = `pref_alert:${p.userId}:${p.id}:${dateKey}`;

      await coreDb
        .insert(preferenceNudges)
        .values({
          userId: p.userId,
          businessId: p.businessId,
          preferenceId: p.id,
          reason: "BALANCE_ENOUGH",
          channel: "push",
          dedupeKey,
        })
        .onConflictDoNothing({ target: preferenceNudges.dedupeKey });

      await coreDb
        .insert(notificationsOutbox)
        .values({
          userId: p.userId,
          type: "PREFERENCE_ALERT",
          title: `Ya te alcanza para tu ${p.label}`,
          message: `Tienes ${Math.round(balance)} Bunz y tu ${p.label} en ${p.businessName ?? "tu lugar"} cuesta ${Math.round(price)}. Pasa cuando quieras.`,
          route: `/affiliate/${p.businessId}`,
          data: { businessId: p.businessId, productId: p.refId, price, balance },
          dedupeKey,
          priority: "normal",
        })
        .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });

      blockedPrefs.add(p.id);
      weeklyByUser.set(p.userId, (weeklyByUser.get(p.userId) ?? 0) + 1);
      sent += 1;
    }

    return NextResponse.json({ success: true, candidates: prefs.length, sent, skipped });
  } catch (error) {
    console.error("[PREFERENCE_NUDGES]", error);
    return NextResponse.json({ success: false, error: "No se pudieron enviar los avisos" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, hint: "POST para evaluar y encolar avisos" });
}
