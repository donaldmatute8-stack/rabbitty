import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses, transactions } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export interface GrowthOpportunity {
  id: string;
  type: "WINBACK_INACTIVE" | "OFF_PEAK_BOOST" | "VIP_LOYALTY_APPRECIATION";
  headline: string;
  explanation: string;
  actionPrompt: string;
  targetCount: number;
  suggestedAction: {
    campaignType: "FLASH_BOOST" | "WINBACK_DIRECT" | "VIP_REWARD";
    rewardPercentage: number;
    maxBudgetBunz: number;
    validityHours: number;
  };
}

/**
 * GET /api/business/growth-signals
 * Returns real, auditable business opportunities for the authenticated affiliate.
 * Rules:
 * 1. Checks affiliate ownership.
 * 2. Analyzes real transactions & customer recency.
 * 3. Enforces k-anonymity (no individual tracking, minimum aggregations).
 * 4. Never automatically emits Bunz; proposes actionable campaigns for merchant approval.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    // 1. Verify business ownership
    const business = await db.query.ownedBusinesses.findFirst({
      where: businessId
        ? and(eq(ownedBusinesses.id, businessId), eq(ownedBusinesses.ownerId, caller.id))
        : eq(ownedBusinesses.ownerId, caller.id),
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado o sin permisos" }, { status: 403 });
    }

    const opportunities: GrowthOpportunity[] = [];

    // 2. Query transactions for this business
    const txHistory = await db.select({
      userId: transactions.userId,
      count: sql<number>`count(*)`,
      lastTx: sql<string>`max(${transactions.createdAt})`,
    }).from(transactions)
      .where(and(
        eq(transactions.businessId, business.id),
        eq(transactions.status, "COMPLETED")
      ))
      .groupBy(transactions.userId);

    const now = Date.now();
    const MS_25_DAYS = 25 * 24 * 60 * 60 * 1000;

    let inactiveCount = 0;
    let vipCount = 0;

    for (const customer of txHistory) {
      const visits = Number(customer.count);
      const lastDate = customer.lastTx ? new Date(customer.lastTx).getTime() : 0;

      // Inactive if last visit was more than 25 days ago
      if (now - lastDate > MS_25_DAYS) {
        inactiveCount++;
      }

      // VIP if 5 or more completed transactions
      if (visits >= 5) {
        vipCount++;
      }
    }

    // Opportunity A: Winback Inactive Customers (Strict k-anonymity threshold >= 5)
    if (inactiveCount >= 5) {
      opportunities.push({
        id: "opp_winback",
        type: "WINBACK_INACTIVE",
        headline: `Tienes ${inactiveCount} clientes sin visita en los últimos 25 días`,
        explanation: "Clientes que ya conocen tu negocio pero no han regresado este mes. Una reactivación con incentivo temporal suele tener la mayor tasa de retorno.",
        actionPrompt: `Activa una invitación con ${business.rewardPercentage + 10}% de cashback válida por 48 horas.`,
        targetCount: inactiveCount,
        suggestedAction: {
          campaignType: "WINBACK_DIRECT",
          rewardPercentage: Math.min(business.rewardPercentage + 10, 35),
          maxBudgetBunz: inactiveCount * 15,
          validityHours: 48,
        },
      });
    }

    // Opportunity B: Off-Peak / Time-based Opportunity with 3-week historical comparison
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay(); // 0 = Sun, 6 = Sat

    // Compare today's transactions in current window against same window over past 3 weeks
    const threeWeeksAgo = new Date(now - 21 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const historicalTxs = await db.select({
      createdAt: transactions.createdAt,
    }).from(transactions)
      .where(and(
        eq(transactions.businessId, business.id),
        eq(transactions.status, "COMPLETED"),
        gte(transactions.createdAt, threeWeeksAgo)
      ));

    // Calculate hourly transaction average for this specific day of week across past 3 weeks
    let matchingHourCount = 0;
    let occurrences = 0;
    for (const tx of historicalTxs) {
      if (!tx.createdAt) continue;
      const d = new Date(tx.createdAt);
      if (d.getDay() === dayOfWeek && d < startOfToday) {
        if (d.getHours() === currentHour) {
          matchingHourCount++;
        }
      }
    }
    occurrences = 3; // 3 past weeks
    const avgHistoricalHourlyTxs = matchingHourCount / occurrences;

    // Check transactions today in the current hour
    const startOfCurrentHour = new Date();
    startOfCurrentHour.setMinutes(0, 0, 0);

    const todayHourTxs = historicalTxs.filter(tx => tx.createdAt && new Date(tx.createdAt) >= startOfCurrentHour).length;

    // Off-peak is confirmed if today's activity is significantly below (< 60%) the historical average for this hour,
    // or if the historical average itself is very low (<= 1 tx/hr)
    const isStatisticallyOffPeak = (avgHistoricalHourlyTxs <= 1) || (todayHourTxs < avgHistoricalHourlyTxs * 0.6);

    if (isStatisticallyOffPeak) {
      opportunities.push({
        id: "opp_off_peak",
        type: "OFF_PEAK_BOOST",
        headline: `Franja de baja afluencia detectada (${currentHour}:00 hrs)`,
        explanation: `Históricamente este horario registra un promedio de ${avgHistoricalHourlyTxs.toFixed(1)} consumos/hora. Un Flash Boost temporal de cashback incentiva visitas de consumo inmediato sin comprometer márgenes permanentes.`,
        actionPrompt: "Lanza un Flash Boost de 2 horas con +10% Bunz adicional.",
        targetCount: 1,
        suggestedAction: {
          campaignType: "FLASH_BOOST",
          rewardPercentage: Math.min(business.rewardPercentage + 10, 40),
          maxBudgetBunz: 150,
          validityHours: 2,
        },
      });
    }

    // Opportunity C: VIP Loyalty Appreciation (Strict k-anonymity >= 5)
    if (vipCount >= 5) {
      opportunities.push({
        id: "opp_vip",
        type: "VIP_LOYALTY_APPRECIATION",
        headline: `${vipCount} clientes habituales con alta fidelidad`,
        explanation: "Clientes recurrentes (más de 5 visitas) que sustentan la mayor parte del ingreso recurrente del negocio. Reconocer su fidelidad fortalece la retención a largo plazo.",
        actionPrompt: "Envíales un agradecimiento VIP con beneficio especial en su siguiente visita.",
        targetCount: vipCount,
        suggestedAction: {
          campaignType: "VIP_REWARD",
          rewardPercentage: Math.min(business.rewardPercentage + 15, 50),
          maxBudgetBunz: vipCount * 25,
          validityHours: 72,
        },
      });
    }

    const todayTxsCount = historicalTxs.filter(tx => tx.createdAt && new Date(tx.createdAt) >= startOfToday).length;

    return NextResponse.json({
      success: true,
      businessId: business.id,
      businessName: business.name,
      baseRewardPercentage: business.rewardPercentage,
      metrics: {
        totalCustomers: txHistory.length,
        inactiveCount,
        vipCount,
        txsTodayCount: todayTxsCount,
      },
      opportunities,
    });
  } catch (error) {
    console.error("[GROWTH_SIGNALS_ERROR]", error);
    return NextResponse.json({ error: "Error al generar señales de crecimiento" }, { status: 500 });
  }
}
