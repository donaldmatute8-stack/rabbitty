import { and, eq, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  membershipSubscriptions,
  membershipEntitlements,
  membershipPlanVersions,
  entitlementUsages,
} from "@rabbitty/database-core/schema";
import { branches, restaurants } from "@rabbitty/database-restaurant/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Siguiente fin de ciclo. FIXED no reinicia. */
function nextCycleEnd(from: Date, reset: string): Date {
  const d = new Date(from);
  if (reset === "DAILY") d.setDate(d.getDate() + 1);
  else if (reset === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (reset === "MONTHLY") d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * ── Aplica beneficios de membresía a una orden (cualquier método de pago) ──
 * Extraído del cierre de `pos.directCheckout` para que el cobro con tarjeta /
 * Rabbitty Pay use EXACTAMENTE las mismas reglas:
 *   · INCLUDED_PRODUCT → 1 unidad gratis del platillo (debe estar en la cuenta)
 *   · DISCOUNT_PCT     → % sobre el neto restante
 *   · CREDIT_BALANCE   → pago parcial con el saldo del pase (nunca cubre el 100%)
 *   · EVENT_ACCESS / BULK_PACK → no impactan el ticket (se registran aparte)
 *
 * Cada consumo es atómico (cuota o crédito condicional) y deja un uso ligado a
 * la orden con idempotencia `ord_<orderId>_ent_<entitlementId>`.
 * Si el cierre del cobro falla, el llamador ejecuta `compensations` para
 * devolver cuotas/crédito y borrar los usos.
 */
export async function applyMembershipBenefitsToOrder(params: {
  coreDb: Db;
  restaurantDb: Db;
  branchId: string;
  staffId?: string | null;
  orderId: string;
  items: Array<{ menuItemId: string; quantity: number; unitPrice: number }>;
  customerId?: string | null;
  entitlementIds?: string[];
  /** Monto antes de impuestos sobre el que se calculan descuentos. */
  baseAmount: number;
}): Promise<{
  finalAmount: number;
  discount: number;
  creditApplied: number;
  compensations: Array<() => Promise<unknown>>;
}> {
  const compensations: Array<() => Promise<unknown>> = [];
  let runningNet = Math.max(0, Number(params.baseAmount) || 0);
  let discount = 0;
  let creditApplied = 0;

  if (!params.entitlementIds?.length) {
    return { finalAmount: runningNet, discount: 0, creditApplied: 0, compensations };
  }
  if (!params.customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vincula al Rabbitter antes de aplicar su beneficio de membresía.",
    });
  }

  const [branchRow] = await params.restaurantDb
    .select({ restaurantId: branches.restaurantId })
    .from(branches)
    .where(eq(branches.id, params.branchId))
    .limit(1);
  const [restRow] = branchRow?.restaurantId
    ? await params.restaurantDb
        .select({ businessId: restaurants.businessId })
        .from(restaurants)
        .where(eq(restaurants.id, branchRow.restaurantId))
        .limit(1)
    : [];
  const membershipBizId = restRow?.businessId ?? null;

  for (const entId of params.entitlementIds) {
    const [ent] = await params.coreDb
      .select()
      .from(membershipEntitlements)
      .where(eq(membershipEntitlements.id, entId))
      .limit(1);
    if (!ent) continue;

    const [sub] = await params.coreDb
      .select()
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.id, ent.subscriptionId))
      .limit(1);
    if (!sub) continue;
    if (sub.businessId !== membershipBizId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "El beneficio no pertenece a este negocio." });
    }
    if (sub.userId !== params.customerId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "El beneficio no pertenece al cliente vinculado." });
    }
    if (sub.status !== "ACTIVE") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La membresía no está activa." });
    }
    if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La membresía está expirada." });
    }

    // Sucursales permitidas por el plan ([] = todas). Las cortesías no tienen
    // planVersion y aplican en cualquier sucursal del negocio.
    if (sub.planVersionId) {
      const [ver] = await params.coreDb
        .select({ branchesAllowed: membershipPlanVersions.branchesAllowed })
        .from(membershipPlanVersions)
        .where(eq(membershipPlanVersions.id, sub.planVersionId))
        .limit(1);
      const allowed = Array.isArray(ver?.branchesAllowed) ? (ver.branchesAllowed as string[]) : [];
      if (allowed.length > 0 && !allowed.includes(params.branchId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Este beneficio de membresía no aplica en esta sucursal.",
        });
      }
    }

    // Reset perezoso del ciclo: sin esto, tras la primera semana la cuota
    // quedaba en 0 para siempre (el panel no la ofrecía y nadie la reiniciaba).
    const now = new Date();
    if (ent.cycleResetType !== "FIXED" && ent.cycleEndDate && new Date(ent.cycleEndDate) <= now) {
      const nextEnd = nextCycleEnd(now, ent.cycleResetType);
      await params.coreDb
        .update(membershipEntitlements)
        .set({ currentUsageInCycle: 0, cycleStartDate: now, cycleEndDate: nextEnd })
        .where(and(
          eq(membershipEntitlements.id, ent.id),
          lt(membershipEntitlements.cycleEndDate, now),
        ));
      ent.currentUsageInCycle = 0;
      ent.cycleEndDate = nextEnd;
    }

    const usageKey = `ord_${params.orderId}_ent_${ent.id}`;
    const [priorUse] = await params.coreDb
      .select({ id: entitlementUsages.id })
      .from(entitlementUsages)
      .where(eq(entitlementUsages.idempotencyKey, usageKey))
      .limit(1);
    if (priorUse) continue;

    let applied = 0;
    if (ent.benefitType === "INCLUDED_PRODUCT" && ent.targetRefId) {
      const freeItem = params.items.find((i) => i.menuItemId === ent.targetRefId);
      if (!freeItem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El platillo incluido no está en la cuenta — agrégalo para usar el beneficio.",
        });
      }
      applied = Math.min(runningNet, Math.max(0, Number(freeItem.unitPrice) || 0));
    } else if (ent.benefitType === "DISCOUNT_PCT" && ent.discountPct != null) {
      applied = Math.round(runningNet * (Number(ent.discountPct) / 100) * 100) / 100;
    } else if (ent.benefitType === "CREDIT_BALANCE") {
      const avail = Number(ent.creditBalance || 0);
      applied = Math.round(Math.min(avail, Math.max(0, runningNet - 0.5)) * 100) / 100;
      if (applied <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El saldo de crédito de la membresía es insuficiente.",
        });
      }
    } else {
      continue; // EVENT_ACCESS / BULK_PACK no impactan el ticket
    }

    if (applied <= 0) continue;

    if (ent.benefitType === "CREDIT_BALANCE") {
      const res = await params.coreDb
        .update(membershipEntitlements)
        .set({ creditBalance: sql`GREATEST(0, COALESCE(${membershipEntitlements.creditBalance}, 0) - ${applied})` })
        .where(and(
          eq(membershipEntitlements.id, ent.id),
          sql`COALESCE(${membershipEntitlements.creditBalance}, 0) >= ${applied}`,
        ))
        .returning({ id: membershipEntitlements.id });
      if (res.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El saldo de la membresía cambió — revisa y vuelve a aplicar.",
        });
      }
      creditApplied = Math.round((creditApplied + applied) * 100) / 100;
      compensations.push(() =>
        params.coreDb
          .update(membershipEntitlements)
          .set({ creditBalance: sql`COALESCE(${membershipEntitlements.creditBalance}, 0) + ${applied}` })
          .where(eq(membershipEntitlements.id, ent.id))
      );
    } else {
      const res = await params.coreDb
        .update(membershipEntitlements)
        .set({ currentUsageInCycle: sql`COALESCE(${membershipEntitlements.currentUsageInCycle}, 0) + 1` })
        .where(and(
          eq(membershipEntitlements.id, ent.id),
          sql`COALESCE(${membershipEntitlements.currentUsageInCycle}, 0) < COALESCE(${membershipEntitlements.quotaPerCycle}, 2147483647)`,
        ))
        .returning({ id: membershipEntitlements.id });
      if (res.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El beneficio no tiene usos disponibles este ciclo.",
        });
      }
      compensations.push(async () => {
        await params.coreDb
          .update(membershipEntitlements)
          .set({ currentUsageInCycle: sql`GREATEST(0, COALESCE(${membershipEntitlements.currentUsageInCycle}, 0) - 1)` })
          .where(eq(membershipEntitlements.id, ent.id));
        await params.coreDb
          .delete(entitlementUsages)
          .where(eq(entitlementUsages.idempotencyKey, usageKey));
      });
    }

    runningNet = Math.round(Math.max(0, runningNet - applied) * 100) / 100;
    discount = Math.round((discount + applied) * 100) / 100;

    await params.coreDb
      .insert(entitlementUsages)
      .values({
        entitlementId: ent.id,
        subscriptionId: ent.subscriptionId,
        branchId: params.branchId,
        staffId: params.staffId ?? null,
        orderId: params.orderId,
        quantityUsed: 1,
        idempotencyKey: usageKey,
      })
      .onConflictDoNothing();
  }

  return { finalAmount: runningNet, discount, creditApplied, compensations };
}
