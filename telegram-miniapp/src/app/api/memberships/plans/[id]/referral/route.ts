import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { membershipPlans, membershipPlanVersions, ownedBusinesses } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { getReferrerSummary } from "@rabbitty/api/services/membershipReferrals";

export const runtime = "nodejs";

/**
 * Lo que gana quien invita, según el programa del negocio.
 * No expone montos de otros Rabbitters: solo el premio del programa y el acumulado
 * del propio usuario.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const [row] = await db
      .select({ businessId: membershipPlans.businessId, businessName: ownedBusinesses.name })
      .from(membershipPlans)
      .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipPlans.currentVersionId))
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipPlans.businessId))
      .where(
        and(
          eq(membershipPlans.isActive, true),
          eq(membershipPlanVersions.isPublished, true),
          or(eq(membershipPlans.id, id), eq(membershipPlans.slug, id)),
        ),
      )
      .limit(1);

    const businessId = row?.businessId ?? "";
    if (!businessId) return NextResponse.json({ success: true, referral: null });

    const summary = await getReferrerSummary(db, businessId, caller.id);
    return NextResponse.json(
      { success: true, referral: { ...summary, businessName: row?.businessName ?? null } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[MEMBERSHIP_REFERRAL_SUMMARY]", error);
    return NextResponse.json({ error: "No se pudo cargar el programa de referidos" }, { status: 500 });
  }
}
