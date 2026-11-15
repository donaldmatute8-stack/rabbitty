import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";
import { menuItems } from "@rabbitty/database-restaurant/schema";
import {
  affiliateCampaigns,
  notificationsOutbox,
  ownedBusinesses,
  userPreferences,
  users,
} from "@rabbitty/database-core";
import { canSendEngagement } from "@rabbitty/api/services/notificationPacing";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/preference-promos ── "tu favorito tiene promo" ────────────────
 *
 * Cruza campañas FLASH_OFFER activas con las preferencias: en vez de mandar la
 * promo a todos, avisa solo a quien suele pedir ese producto en ese negocio y
 * le alcanza el saldo. Un aviso por campaña y usuario, con ritmo de 48 h.
 */

const MIN_SCORE = 0.25;
const PACING_HOURS = 48;
const BALANCE_MARGIN = 1.05;
const MAX_PER_RUN = 150;

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
    const restaurantDb = getRestaurantDb();
    const now = new Date();

    const campaigns = await coreDb
      .select({
        id: affiliateCampaigns.id,
        businessId: affiliateCampaigns.businessId,
        title: affiliateCampaigns.title,
        headline: affiliateCampaigns.headline,
        message: affiliateCampaigns.message,
        rewardPercentage: affiliateCampaigns.rewardPercentage,
        expiresAt: affiliateCampaigns.expiresAt,
        businessName: ownedBusinesses.name,
      })
      .from(affiliateCampaigns)
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, affiliateCampaigns.businessId))
      .where(
        and(
          eq(affiliateCampaigns.campaignType, "FLASH_OFFER"),
          eq(affiliateCampaigns.status, "ACTIVE"),
          gte(affiliateCampaigns.expiresAt, now),
          lt(affiliateCampaigns.budgetSpent, affiliateCampaigns.budgetBunz),
          inArray(ownedBusinesses.status, ["APPROVED", "VERIFIED"]),
        ),
      )
      .limit(20);

    if (campaigns.length === 0) {
      return NextResponse.json({ success: true, campaigns: 0, sent: 0 });
    }

    let sent = 0;
    const skipped = { noOptIn: 0, muted: 0, pacing: 0, already: 0, notEnough: 0, unavailable: 0 };

    for (const campaign of campaigns) {
      const prefs = await coreDb
        .select({
          id: userPreferences.id,
          userId: userPreferences.userId,
          refId: userPreferences.refId,
          label: userPreferences.label,
          balance: sql<number>`GREATEST(0, COALESCE(${users.totalBunzEarned}, 0) - COALESCE(${users.totalBunzSpent}, 0))`,
          pushRules: users.pushRules,
          muted: users.pushMutedCategories,
        })
        .from(userPreferences)
        .innerJoin(users, eq(users.id, userPreferences.userId))
        .where(
          and(
            eq(userPreferences.businessId, campaign.businessId),
            eq(userPreferences.kind, "PRODUCT"),
            gte(userPreferences.score, MIN_SCORE),
          ),
        )
        .limit(200);

      if (prefs.length === 0) continue;

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

      for (const p of prefs) {
        if (sent >= MAX_PER_RUN) break;

        const rules = parseJson<Record<string, boolean>>(p.pushRules, {});
        if (rules.favoriteAlerts !== true) { skipped.noOptIn += 1; continue; }
        const muted = parseJson<string[]>(p.muted, []);
        if (muted.includes("favorites")) { skipped.muted += 1; continue; }

        const item = itemById.get(p.refId);
        if (!item || !item.isActive || !item.isAvailable) { skipped.unavailable += 1; continue; }
        const price = Number(item.price ?? 0);
        const balance = Number(p.balance ?? 0);
        if (price <= 0 || balance < price * BALANCE_MARGIN) { skipped.notEnough += 1; continue; }

        const dedupeKey = `pref_promo:${campaign.id}:${p.userId}`;
        const [prior] = await coreDb
          .select({ id: notificationsOutbox.id })
          .from(notificationsOutbox)
          .where(eq(notificationsOutbox.dedupeKey, dedupeKey))
          .limit(1);
        if (prior) { skipped.already += 1; continue; }

        if (!(await canSendEngagement(coreDb, p.userId, PACING_HOURS))) { skipped.pacing += 1; continue; }

        await coreDb
          .insert(notificationsOutbox)
          .values({
            userId: p.userId,
            type: "PREFERENCE_PROMO",
            title: `Tu ${p.label} tiene +${campaign.rewardPercentage}% Bunz`,
            message: `${campaign.headline || campaign.title} en ${campaign.businessName ?? "tu lugar"}. Te alcanza con tus ${Math.round(balance)} Bunz.`,
            route: `/affiliate/${campaign.businessId}`,
            data: {
              businessId: campaign.businessId,
              productId: p.refId,
              campaignId: campaign.id,
              rewardPercentage: campaign.rewardPercentage,
            },
            dedupeKey,
            priority: "normal",
          })
          .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });

        sent += 1;
      }
    }

    return NextResponse.json({ success: true, campaigns: campaigns.length, sent, skipped });
  } catch (error) {
    console.error("[PREFERENCE_PROMOS]", error);
    return NextResponse.json({ success: false, error: "No se pudieron avisar las promos" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, hint: "POST para avisar promos sobre favoritos" });
}
