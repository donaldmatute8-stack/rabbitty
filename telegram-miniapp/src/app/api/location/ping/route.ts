import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses, transactions, notifications, affiliateCampaigns } from "@/db/schema";
import { and, eq, inArray, sql, gt } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { isApnsConfigured, sendPushToUser } from "@/lib/push/apns";
import { restaurantDb } from "@/db/restaurant";
import { restaurants, branches, events } from "@rabbitty/database-restaurant/schema";

/**
 * Calculates geodetic distance in meters using the Haversine formula.
 */
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

import { checkRateLimit } from "@/lib/rateLimit";

const COOLDOWN_SECONDS = 12 * 60 * 60; // 12 horas

async function isCooldownActive(key: string, cooldownSec: number): Promise<boolean> {
  const res = await checkRateLimit(`cd:${key}`, 1, cooldownSec);
  return !res.allowed;
}

interface ProximityMatch {
  businessId: string;
  businessName: string;
  category: string;
  distanceMeters: number;
  rewardPercentage: number;
  hasActiveBoost?: boolean;
  boostTitle?: string;
  loyaltyOffer?: {
    type: "DOUBLE_CASHBACK_VIP" | "PERSONAL_REWARD_100" | "FLASH_BOOST";
    title: string;
    description: string;
    pastVisits: number;
    multiplier: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    const body = await req.json();
    const { lat, lng, accuracy, timestamp, stationary, prevLat, prevLng } = body;
    // "Inmóvil": el cliente compara con su ping anterior (dist < 25m) o reporta speed≈0

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
    }

    // Validación estricta de frescura: rechazar lecturas de geolocalización obsoletas (>60s)
    if (typeof timestamp === "number" && Date.now() - timestamp > 60_000) {
      return NextResponse.json({
        success: false,
        error: "Lectura GPS obsoleta. El motor de proximidad exige coordenadas en tiempo real (<60s).",
        reason: "stale_location",
      }, { status: 400 });
    }

    if (caller?.id) {
      const rl = await checkRateLimit(`ping:${caller.id}`, 10, 30);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Too many location pings" }, { status: 429 });
      }
    }

    const businesses = await db
      .select()
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.status, "APPROVED"))
      .limit(200);

    const matches: ProximityMatch[] = [];
    const triggeredOffers: string[] = [];

    const nearBusinesses: Array<{ business: (typeof businesses)[0]; dist: number }> = [];
    for (const b of businesses) {
      if (typeof b.lat !== "number" || typeof b.lng !== "number") continue;
      const dist = getDistanceMeters(lat, lng, b.lat, b.lng);
      if (dist <= 2500) {
        nearBusinesses.push({ business: b, dist });
      }
    }

    // Fetch any active campaigns / flash boosts for nearby businesses
    const nearBusinessIds = nearBusinesses.map((nb) => nb.business.id);
    const activeCampaignsMap = new Map<string, { rewardPercentage: number; title: string; headline: string; maxRewardPerUser: number }>();
    if (nearBusinessIds.length > 0) {
      const now = new Date();
      const campaigns = await db
        .select()
        .from(affiliateCampaigns)
        .where(
          and(
            inArray(affiliateCampaigns.businessId, nearBusinessIds),
            eq(affiliateCampaigns.campaignType, "FLASH_OFFER"),
            eq(affiliateCampaigns.status, "ACTIVE"),
            gt(affiliateCampaigns.expiresAt, now)
          )
        );
      for (const cmp of campaigns) {
        // Keep the highest reward percentage if multiple campaigns exist
        const existing = activeCampaignsMap.get(cmp.businessId);
        if (!existing || cmp.rewardPercentage > existing.rewardPercentage) {
          activeCampaignsMap.set(cmp.businessId, {
            rewardPercentage: cmp.rewardPercentage,
            title: cmp.title,
            headline: cmp.headline,
            maxRewardPerUser: cmp.maxRewardPerUser || 50,
          });
        }
      }
    }

    const visitCountMap = new Map<string, number>();
    if (caller) {
      const proxBusinessIds = nearBusinesses
        .filter((nb) => nb.dist <= 250)
        .map((nb) => nb.business.id);
      if (proxBusinessIds.length > 0) {
        const counts = await db
          .select({
            businessId: transactions.businessId,
            count: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, caller.id),
              inArray(transactions.businessId, proxBusinessIds),
              eq(transactions.status, "COMPLETED")
            )
          )
          .groupBy(transactions.businessId);
        for (const c of counts) {
          visitCountMap.set(c.businessId, Number(c.count ?? 0));
        }
      }
    }

    for (const nb of nearBusinesses) {
      const b = nb.business;
      const dist = nb.dist;
      const activeBoost = activeCampaignsMap.get(b.id);
      const effectiveReward = activeBoost ? Math.max(b.rewardPercentage, activeBoost.rewardPercentage) : b.rewardPercentage;

      const match: ProximityMatch = {
        businessId: b.id,
        businessName: b.name,
        category: b.category,
        distanceMeters: dist,
        rewardPercentage: effectiveReward,
        hasActiveBoost: !!activeBoost,
        boostTitle: activeBoost?.headline || activeBoost?.title,
      };

      if (caller && dist <= 250 && (!accuracy || accuracy <= 200)) {
        const visitCount = visitCountMap.get(b.id) ?? 0;

        // Si el comercio tiene un Flash Boost activo, priorizar la oferta de proximidad especial
        if (activeBoost && activeBoost.rewardPercentage > b.rewardPercentage) {
          match.loyaltyOffer = {
            type: "FLASH_BOOST",
            title: `⚡ ¡Flash Boost en ${b.name}!`,
            description: `${activeBoost.headline || activeBoost.title}: Obtén +${activeBoost.rewardPercentage}% Bunz en tu consumo hoy al pagar en caja.`,
            pastVisits: visitCount,
            multiplier: 1.0,
          };

          const cooldownKey = `push:boost:${caller.id}:${b.id}`;
          const isBoostCoolingDown = await isCooldownActive(cooldownKey, COOLDOWN_SECONDS);

          if (!isBoostCoolingDown) {
            const pushTitle = `⚡ ¡${activeBoost.rewardPercentage}% Bunz en ${b.name}!`;
            const pushBody = `Pasa en tu caminata de hoy: ${activeBoost.headline || `obtenemos recompensa especial de +${activeBoost.rewardPercentage}% Bunz`}.`;

            await db
              .insert(notifications)
              .values({
                userId: caller.id,
                title: pushTitle,
                message: pushBody,
                type: "LOYALTY_OFFER",
              })
              .catch(() => {});

            if (isApnsConfigured()) {
              sendPushToUser(caller.id, {
                title: pushTitle,
                body: pushBody,
                data: {
                  type: "PROXIMITY_BOOST",
                  businessId: b.id,
                  businessName: b.name,
                  rewardPercentage: activeBoost.rewardPercentage,
                },
              }).catch((err) => {
                console.warn("[LOCATION_PING] Push send error:", err);
              });
            }

            triggeredOffers.push(b.name);
          }
        } else if (visitCount >= 10) {
          match.loyaltyOffer = {
            type: "DOUBLE_CASHBACK_VIP",
            title: `¡Bonificación Especial en ${b.name}!`,
            description: `Por tu fidelidad (${visitCount} visitas), recibe doble cashback (hasta 50 Bunz) en tu consumo de hoy al pagar en caja.`,
            pastVisits: visitCount,
            multiplier: 2.0,
          };

          const cooldownKey = `push:loyalty:${caller.id}:${b.id}`;
          const isCoolingDown = await isCooldownActive(cooldownKey, COOLDOWN_SECONDS);

          if (!isCoolingDown) {
            const pushTitle = `🐰 ¡Estás cerca de ${b.name}!`;
            const pushBody = `Visita #${visitCount + 1}: Recibe doble cashback (hasta 50 Bunz) en tu consumo de hoy al pagar en caja.`;

            await db
              .insert(notifications)
              .values({
                userId: caller.id,
                title: pushTitle,
                message: pushBody,
                type: "LOYALTY_OFFER",
              })
              .catch(() => {});

            if (isApnsConfigured()) {
              sendPushToUser(caller.id, {
                title: pushTitle,
                body: pushBody,
                data: {
                  type: "PROXIMITY_LOYALTY",
                  businessId: b.id,
                  businessName: b.name,
                },
              }).catch((err) => {
                console.warn("[LOCATION_PING] Push send error:", err);
              });
            }

            triggeredOffers.push(b.name);
          }
        }

        if (dist <= 60) {
          const poorAccuracy = typeof accuracy === "number" && accuracy > 80;
          if (!poorAccuracy) {
            const arrivalKey = `arrival:${caller.id}:${b.id}`;
            const isArrivalCoolingDown = await isCooldownActive(arrivalKey, 4 * 60 * 60);
            if (!isArrivalCoolingDown) {
              try {
                const [rest] = await restaurantDb
                  .select()
                  .from(restaurants)
                  .where(eq(restaurants.businessId, b.id))
                  .limit(1);
                if (rest) {
                  const [branch] = await restaurantDb
                    .select()
                    .from(branches)
                    .where(eq(branches.restaurantId, rest.id))
                    .limit(1);
                  if (branch) {
                    await restaurantDb
                      .insert(events)
                      .values({
                        branchId: branch.id,
                        type: "CUSTOMER_ARRIVAL",
                        payload: {
                          userId: caller.id,
                          username: caller.username || "Rabbitter",
                          visitCount,
                          isVip: visitCount >= 10,
                          arrivedAt: new Date().toISOString(),
                          distanceMeters: dist,
                          accuracy: typeof accuracy === "number" ? accuracy : undefined,
                        },
                      })
                      .catch((err) => {
                        console.warn("[LOCATION_PING] Failed to insert CUSTOMER_ARRIVAL event:", err);
                      });
                  }
                }
              } catch (err) {
                console.warn("[LOCATION_PING] Error looking up restaurant/branch for arrival:", err);
              }
            }
          }
        }
      }

      matches.push(match);
    }

    matches.sort((a, b) => a.distanceMeters - b.distanceMeters);


    // ── Presencia GPS: si el rabbitter está cerca (≤40m) e inmóvil de UN negocio ──
    let confirmPresence: { businessId: string; businessName: string } | null = null;
    if (caller?.id && typeof lat === "number" && typeof lng === "number") {
      const closest = businesses
        .map((b) => (typeof b.lat === "number" && typeof b.lng === "number" ? { b, d: getDistanceMeters(lat, lng, b.lat, b.lng) } : null))
        .filter((x): x is { b: typeof businesses[0]; d: number } => !!x && x.d <= 40)
        .sort((a, b) => a.d - b.d)[0];
      if (closest) {
        const isStationary = stationary === true || (typeof prevLat === "number" && typeof prevLng === "number" && Math.abs(getDistanceMeters(prevLat, prevLng, lat, lng)) < 25);
        try {
          const now = new Date();
          // ¿Sesión abierta de este usuario en este negocio?
          const [openHere] = await db.execute(
            sql`SELECT id FROM "presenceSessions" WHERE "userId" = ${caller.id} AND "businessId" = ${closest.b.id} AND "endedAt" IS NULL LIMIT 1`
          ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
          // ¿Sesión abierta en OTRO negocio? → se movió → cerrarla
          const openOther = await db.execute(
            sql`SELECT id FROM "presenceSessions" WHERE "userId" = ${caller.id} AND "businessId" != ${closest.b.id} AND "endedAt" IS NULL`
          ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
          for (const other of openOther) {
            await db.execute(sql`UPDATE "presenceSessions" SET "endedAt" = now(), "updatedAt" = now() WHERE id = ${other.id}`);
          }
          if (openHere) {
            // Refrescar permanencia
            await db.execute(sql`UPDATE "presenceSessions" SET "lastPingAt" = now(), "updatedAt" = now() WHERE id = ${openHere.id}`);
          } else if (isStationary) {
            // No hay sesión y está inmóvil cerca → pedir confirmación (el cliente respeta cooldowns)
            const [todaySession] = await db.execute(
              sql`SELECT id FROM "presenceSessions" WHERE "userId" = ${caller.id} AND "businessId" = ${closest.b.id} AND "startedAt" >= now() - interval '12 hours' LIMIT 1`
            ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
            if (!todaySession) {
              confirmPresence = { businessId: closest.b.id, businessName: closest.b.name };
            }
          }
        } catch (pErr) {
          console.error("[LOCATION_PING] presencia GPS falló:", pErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      nearbyCount: matches.length,
      immediateMatches: matches.filter((m) => m.distanceMeters <= 250),
      matches: matches.slice(0, 10),
      triggeredOffers,
      confirmPresence,
    });
  } catch (error) {
    console.error("[LOCATION_PING_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
