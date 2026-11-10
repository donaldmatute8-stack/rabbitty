import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  membershipEntitlements,
  users,
  notifications,
} from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

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

/** Regala un plan gratuito a otro Rabbitter (el comprador lo envía). */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const planVersionId = String(body?.planVersionId || "");
    const recipientRaw = String(body?.recipient || "").trim();
    const message = String(body?.message || "").trim().slice(0, 300);
    if (!planVersionId || !recipientRaw) {
      return NextResponse.json({ error: "Faltan plan y destinatario" }, { status: 400 });
    }

    const [row] = await db
      .select({ plan: membershipPlans, version: membershipPlanVersions })
      .from(membershipPlanVersions)
      .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
      .where(
        and(
          eq(membershipPlanVersions.id, planVersionId),
          eq(membershipPlanVersions.isPublished, true),
          eq(membershipPlans.isActive, true),
          sql`${membershipPlans.currentVersionId} = ${membershipPlanVersions.id}`,
        ),
      )
      .limit(1);
    if (!row) return NextResponse.json({ error: "Plan no disponible" }, { status: 404 });
    if (Number(row.version.priceFiat) !== 0) {
      return NextResponse.json({ error: "El regalo de planes pagados estará disponible pronto" }, { status: 400 });
    }

    const q = recipientRaw.replace(/^@/, "");
    const [target] = await db
      .select({ id: users.id, firstName: users.firstName, username: users.username })
      .from(users)
      .where(or(eq(users.username, q), eq(users.id, q), eq(users.phoneNumber, q)))
      .limit(1);
    if (!target) return NextResponse.json({ error: "No encontramos a ese Rabbitter" }, { status: 404 });
    if (target.id === caller.id) return NextResponse.json({ error: "No puedes regalarte tu propia membresía" }, { status: 400 });

    const [dup] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
      .where(
        and(
          eq(membershipSubscriptions.userId, target.id),
          eq(membershipPlanVersions.planId, row.plan.id),
          eq(membershipSubscriptions.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (dup) return NextResponse.json({ error: "Ese Rabbitter ya tiene esta membresía" }, { status: 409 });

    const now = new Date();
    const hardEnd = new Date(now);
    hardEnd.setFullYear(hardEnd.getFullYear() + 99);

    const [sub] = await db
      .insert(membershipSubscriptions)
      .values({
        userId: target.id,
        businessId: row.plan.businessId,
        planVersionId: row.version.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: null,
        noExpiration: true,
        paymentProvider: null,
        membershipOrigin: "GIFT",
        issuedByUserId: caller.id,
        giftNote: message || null,
        acquisitionSource: "GIFT",
        qrPassSecret: crypto.randomBytes(32).toString("hex"),
      })
      .returning();
    if (!sub) return NextResponse.json({ error: "No se pudo crear el regalo" }, { status: 500 });

    const rules = (row.version.benefitRules ?? []) as Rule[];
    if (rules.length > 0) {
      await db.insert(membershipEntitlements).values(
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

    await db.insert(notifications).values({
      userId: target.id,
      title: `🎁 Te regalaron ${row.plan.name}`,
      message: message ? `Con nota: "${message}" — ábrela en Mis Membresías.` : "Ábrela en Mis Membresías y muéstrala en caja.",
      type: "REWARD",
      route: "/memberships",
    }).catch(() => {});

    return NextResponse.json({ success: true, subscriptionId: sub.id, recipientName: target.firstName || target.username || "Rabbitter" });
  } catch (error) {
    console.error("[MEMBERSHIP_GIFT]", error);
    return NextResponse.json({ error: "No se pudo enviar el regalo" }, { status: 500 });
  }
}
