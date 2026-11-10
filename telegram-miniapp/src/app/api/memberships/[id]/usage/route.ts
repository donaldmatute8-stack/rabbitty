import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { membershipSubscriptions, membershipEntitlements, entitlementUsages } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/** Historial de uso de una membresía del usuario autenticado. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const [sub] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.id, id), eq(membershipSubscriptions.userId, caller.id)))
      .limit(1);
    if (!sub) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const rows = await db
      .select({
        id: entitlementUsages.id,
        benefitType: membershipEntitlements.benefitType,
        quantityUsed: entitlementUsages.quantityUsed,
        redeemedAt: entitlementUsages.redeemedAt,
        orderId: entitlementUsages.orderId,
        branchId: entitlementUsages.branchId,
      })
      .from(entitlementUsages)
      .innerJoin(
        membershipEntitlements,
        eq(membershipEntitlements.id, entitlementUsages.entitlementId),
      )
      .where(eq(entitlementUsages.subscriptionId, id))
      .orderBy(desc(entitlementUsages.redeemedAt))
      .limit(50);

    const total = rows.reduce((sum, r) => sum + Number(r.quantityUsed || 1), 0);
    return NextResponse.json(
      { success: true, total, usages: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[memberships] usage error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
