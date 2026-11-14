import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, ownedBusinesses } from "@/db/schema";
import { restaurantDb } from "@/db/restaurant";
import { orders, posChargeRequests } from "@rabbitty/database-restaurant/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/**
 * ── Captura del cobro en Bunz (ADR-027) ────────────────────────────────────
 *
 * Se llama cuando el cliente ya aprobó en su app. Usa el motor canónico
 * (`paymentCore`): reserva, saldo, capacidad del afiliado, libro y comprobante.
 * Si algo falla no se marca nada como cobrado.
 */

const schema = z.object({
  businessId: z.string().uuid(),
  requestId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { businessId, requestId } = parsed.data;

  const [business] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
  if (!business) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  if (business.ownerId !== caller.id) {
    return NextResponse.json({ error: "Solo el dueño del negocio puede cobrar aquí" }, { status: 403 });
  }

  const [approval] = await restaurantDb
    .select()
    .from(posChargeRequests)
    .where(eq(posChargeRequests.id, requestId))
    .limit(1);
  if (!approval) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });

  if (approval.status === "CHARGED") {
    return NextResponse.json({ success: true, alreadyCharged: true, amount: Number(approval.amount) });
  }
  if (approval.status !== "APPROVED") {
    return NextResponse.json(
      { error: approval.status === "PENDING" ? "El cliente aún no autoriza" : "La solicitud no está aprobada" },
      { status: 409 },
    );
  }
  if (!approval.orderId) return NextResponse.json({ error: "La solicitud no tiene orden" }, { status: 409 });

  try {
    const { createOrGetPaymentIntent, confirmPaymentIntentSettled } = await import(
      "@rabbitty/api/services/paymentCore"
    );

    const intent = await createOrGetPaymentIntent(restaurantDb as never, {
      branchId: String(approval.branchId),
      orderId: approval.orderId,
      payerUserId: approval.customerId,
      bunzToApply: Number(approval.amount),
      tipMxn: 0,
      provider: "BUNZ_ONLY",
    });

    const settled = await confirmPaymentIntentSettled(restaurantDb as never, {
      paymentIntentId: intent.intentId,
      verifiedMethod: "BUNZ_ONLY",
      expectedBranchId: String(approval.branchId),
    });

    if (!settled.success) {
      return NextResponse.json(
        { error: "No se pudo capturar el cobro. Revisa el saldo del cliente e intenta de nuevo." },
        { status: 409 },
      );
    }

    await restaurantDb
      .update(posChargeRequests)
      .set({ status: "CHARGED", respondedAt: new Date() })
      .where(eq(posChargeRequests.id, requestId));

    await restaurantDb
      .update(orders)
      .set({ status: "COMPLETED" })
      .where(and(eq(orders.id, approval.orderId), eq(orders.status, "PENDING")));

    const [customer] = await db
      .select({ earned: users.totalBunzEarned, spent: users.totalBunzSpent })
      .from(users)
      .where(eq(users.id, approval.customerId))
      .limit(1);

    return NextResponse.json({
      success: true,
      orderId: approval.orderId,
      amount: Number(approval.amount),
      balance: Math.max(0, Number(customer?.earned ?? 0) - Number(customer?.spent ?? 0)),
    });
  } catch (error) {
    console.error("[BUSINESS_CHARGE_SETTLE]", error);
    return NextResponse.json({ error: "No se pudo capturar el cobro" }, { status: 500 });
  }
}
