import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  membershipEntitlements,
  users,
} from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { grantReferralReward } from "@rabbitty/api/services/membershipReferrals";

export const runtime = "nodejs";

type Rule = {
  type: string;
  targetRefId?: string | null;
  quotaPerCycle: number;
  cycleResetType: string;
  discountPct?: number | null;
  creditBalance?: number | null;
};

function addCycle(from: Date, reset: string, hardEnd: Date): Date {
  const d = new Date(from);
  if (reset === "DAILY") d.setDate(d.getDate() + 1);
  else if (reset === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (reset === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else return hardEnd;
  return d > hardEnd ? hardEnd : d;
}

/** Alta inmediata de un plan gratuito publicado (sin Stripe). */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const planId = String(body?.planId || "");
    const planVersionId = String(body?.planVersionId || "");
    const ref = String(body?.ref || "").trim();
    let referredByUserId: string | null = null;
    if (ref && ref !== caller.id && /^[0-9a-f-]{36}$/i.test(ref)) {
      const [refUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, ref)).limit(1);
      if (refUser) referredByUserId = refUser.id;
    }
    if (!planId && !planVersionId) {
      return NextResponse.json({ error: "planId o planVersionId requerido" }, { status: 400 });
    }

    const [row] = await db
      .select({ plan: membershipPlans, version: membershipPlanVersions })
      .from(membershipPlanVersions)
      .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
      .where(
        and(
          planVersionId
            ? eq(membershipPlanVersions.id, planVersionId)
            : eq(membershipPlans.id, planId),
          eq(membershipPlanVersions.isPublished, true),
          eq(membershipPlans.isActive, true),
          eq(membershipPlans.isMarketplaceVisible, true),
          sql`${membershipPlans.currentVersionId} = ${membershipPlanVersions.id}`,
        ),
      )
      .limit(1);

    if (!row) return NextResponse.json({ error: "Plan no disponible" }, { status: 404 });
    if (Number(row.version.priceFiat) !== 0) {
      return NextResponse.json({ error: "Este plan requiere pago" }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: membershipSubscriptions.id })
        .from(membershipSubscriptions)
        .innerJoin(
          membershipPlanVersions,
          eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId),
        )
        .where(
          and(
            eq(membershipSubscriptions.userId, caller.id),
            eq(membershipPlanVersions.planId, row.plan.id),
            eq(membershipSubscriptions.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (existing) {
        return { subscriptionId: existing.id, already: true, founding: false };
      }

      if (row.version.maxMembersLimit) {
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(membershipSubscriptions)
          .innerJoin(
            membershipPlanVersions,
            eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId),
          )
          .where(
            and(
              eq(membershipPlanVersions.planId, row.plan.id),
              eq(membershipSubscriptions.status, "ACTIVE"),
            ),
          );
        if (Number(countRow?.count ?? 0) >= row.version.maxMembersLimit) {
          throw new Error("MEMBERSHIP_FULL");
        }
      }

      const [memberCountRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(membershipSubscriptions)
        .innerJoin(
          membershipPlanVersions,
          eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId),
        )
        .where(
          and(
            eq(membershipPlanVersions.planId, row.plan.id),
            eq(membershipSubscriptions.status, "ACTIVE"),
          ),
        );
      const currentCount = Number(memberCountRow?.count ?? 0);
      const founding =
        row.plan.foundingSlots != null && currentCount < Number(row.plan.foundingSlots);

      const now = new Date();
      const hardEnd = new Date(now);
      hardEnd.setFullYear(hardEnd.getFullYear() + 99);

      const [sub] = await tx
        .insert(membershipSubscriptions)
        .values({
          userId: caller.id,
          businessId: row.plan.businessId,
          planVersionId: row.version.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: null,
          noExpiration: true,
          paymentProvider: "PROMO",
          membershipOrigin: "PURCHASED",
          acquisitionSource: referredByUserId ? "REFERRAL" : "MARKETPLACE",
          referredByUserId,
          qrPassSecret: crypto.randomBytes(32).toString("hex"),
        })
        .returning({ id: membershipSubscriptions.id });

      const rules = (row.version.benefitRules ?? []) as Rule[];
      if (rules.length > 0) {
        await tx.insert(membershipEntitlements).values(
          rules.map((r) => ({
            subscriptionId: sub.id,
            benefitType: r.type,
            targetRefId: r.targetRefId ?? null,
            quotaPerCycle: r.quotaPerCycle,
            cycleResetType: r.cycleResetType,
            currentUsageInCycle: 0,
            cycleStartDate: now,
            cycleEndDate: addCycle(now, r.cycleResetType, hardEnd),
            discountPct: r.discountPct ?? null,
            creditBalance: r.creditBalance ?? null,
          })),
        );
      }

      return { subscriptionId: sub.id, already: false, founding };
    });

    // Recompensa por referido: la paga el negocio desde su bóveda de Bunz.
    let referral: unknown = null;
    if (!result.already) {
      referral = await grantReferralReward({
        db,
        businessId: row.plan.businessId,
        referrerUserId: referredByUserId,
        referredUserId: caller.id,
        subscriptionId: result.subscriptionId,
        planId: row.plan.id,
      });
    }

    return NextResponse.json({ success: true, ...result, referral });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_FULL") {
      return NextResponse.json({ error: "Cupo de miembros agotado" }, { status: 409 });
    }
    console.error("[MEMBERSHIP_JOIN_FREE]", error);
    return NextResponse.json({ error: "No se pudo activar la membresía" }, { status: 500 });
  }
}
