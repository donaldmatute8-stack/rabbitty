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

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type BenefitLine = {
  entitlementId: string;
  benefitType: string;
  subscriptionId: string;
  /** Monto que cubre este beneficio, en pesos. 0 = no aplica a esta cuenta. */
  applied: number;
  /** El ciclo ya no tiene usos disponibles. */
  exhausted: boolean;
  /** Motivo legible cuando applied = 0. */
  reason?: string;
};

export type BenefitPlan = {
  finalAmount: number;
  discount: number;
  creditApplied: number;
  lines: BenefitLine[];
};

export type LoadedEntitlement = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sub: any;
};

/**
 * ── Cálculo puro de beneficios ──────────────────────────────────────────────
 *
 * Es la ÚNICA fuente de la aritmética: la usan el cobro real y la vista previa
 * del POS. Sin efectos secundarios, para que el cajero vea exactamente el total
 * que se va a cobrar antes de confirmar.
 *
 * Prioridad: consumo del socio (100%) → producto incluido → % → crédito. Así el
 * porcentaje de acompañantes se calcula sobre lo que queda, no al revés.
 */
export function computeBenefitPlan(params: {
  loaded: LoadedEntitlement[];
  items: Array<{ menuItemId: string; quantity: number; unitPrice: number }>;
  baseAmount: number;
  memberMenuItemIds?: string[];
  /** Beneficios ya consumidos para esta orden (reintentos). */
  skipIds?: Set<string>;
}): BenefitPlan {
  const priority: Record<string, number> = {
    MEMBER_CONSUMPTION: 0,
    INCLUDED_PRODUCT: 1,
    DISCOUNT_PCT: 2,
    CREDIT_BALANCE: 3,
  };
  const ordered = [...params.loaded].sort(
    (a, b) => (priority[a.ent.benefitType] ?? 9) - (priority[b.ent.benefitType] ?? 9),
  );

  let runningNet = round(Math.max(0, Number(params.baseAmount) || 0));
  let discount = 0;
  let creditApplied = 0;
  const lines: BenefitLine[] = [];

  for (const { ent } of ordered) {
    const line: BenefitLine = {
      entitlementId: ent.id,
      benefitType: ent.benefitType,
      subscriptionId: ent.subscriptionId,
      applied: 0,
      exhausted: false,
    };

    if (params.skipIds?.has(ent.id)) {
      line.reason = "Ya aplicado en esta orden";
      lines.push(line);
      continue;
    }

    const usage = Number(ent.currentUsageInCycle ?? 0);
    const quota = ent.quotaPerCycle == null ? null : Number(ent.quotaPerCycle);
    if (quota != null && usage >= quota) {
      line.exhausted = true;
      line.reason = "Sin usos disponibles este ciclo";
      lines.push(line);
      continue;
    }

    let applied = 0;
    if (ent.benefitType === "MEMBER_CONSUMPTION") {
      const marked = params.memberMenuItemIds ?? [];
      const memberAmount = params.items
        .filter((i) => marked.includes(i.menuItemId))
        .reduce((sum, i) => sum + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1), 0);
      applied = round(Math.min(runningNet, memberAmount));
      if (marked.length === 0) line.reason = "Marca los artículos del socio";
      else if (memberAmount <= 0) line.reason = "Los artículos marcados no están en la cuenta";
    } else if (ent.benefitType === "INCLUDED_PRODUCT" && ent.targetRefId) {
      const freeItem = params.items.find((i) => i.menuItemId === ent.targetRefId);
      if (!freeItem) {
        line.reason = "El producto incluido no está en la cuenta";
      } else {
        applied = round(Math.min(runningNet, Math.max(0, Number(freeItem.unitPrice) || 0)));
      }
    } else if (ent.benefitType === "DISCOUNT_PCT" && ent.discountPct != null) {
      applied = round(runningNet * (Number(ent.discountPct) / 100));
    } else if (ent.benefitType === "CREDIT_BALANCE") {
      const available = Number(ent.creditBalance ?? 0);
      applied = round(Math.min(available, Math.max(0, runningNet - 0.5)));
      if (applied <= 0) line.reason = "Saldo de crédito insuficiente";
    } else {
      line.reason = "No impacta el ticket";
      lines.push(line);
      continue;
    }

    if (applied <= 0) {
      lines.push(line);
      continue;
    }

    line.applied = applied;
    runningNet = round(Math.max(0, runningNet - applied));
    discount = round(discount + applied);
    if (ent.benefitType === "CREDIT_BALANCE") creditApplied = round(creditApplied + applied);
    lines.push(line);
  }

  return { finalAmount: runningNet, discount, creditApplied, lines };
}

/**
 * Carga y valida los beneficios del cliente para esta sucursal.
 * No consume ni reinicia ciclos: eso lo hace el cobro real.
 */
export async function loadValidatedEntitlements(params: {
  coreDb: Db;
  restaurantDb: Db;
  branchId: string;
  customerId?: string | null;
  entitlementIds?: string[];
}): Promise<{ loaded: LoadedEntitlement[]; businessId: string | null }> {
  if (!params.entitlementIds?.length) return { loaded: [], businessId: null };
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

  const loaded: LoadedEntitlement[] = [];
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

    loaded.push({ ent, sub });
  }

  return { loaded, businessId: membershipBizId };
}

/**
 * Vista previa para el POS: mismo cálculo que el cobro, sin consumir nada.
 * Trata un ciclo vencido como cuota completa (el cobro lo reinicia al aplicar).
 */
export async function previewMembershipBenefits(params: {
  coreDb: Db;
  restaurantDb: Db;
  branchId: string;
  customerId?: string | null;
  entitlementIds?: string[];
  items: Array<{ menuItemId: string; quantity: number; unitPrice: number }>;
  memberMenuItemIds?: string[];
  baseAmount: number;
}): Promise<BenefitPlan> {
  const { loaded } = await loadValidatedEntitlements(params);

  const now = new Date();
  const projected = loaded.map(({ ent, sub }) => {
    const expired = ent.cycleResetType !== "FIXED" && ent.cycleEndDate && new Date(ent.cycleEndDate) <= now;
    return { ent: expired ? { ...ent, currentUsageInCycle: 0 } : ent, sub };
  });

  return computeBenefitPlan({
    loaded: projected,
    items: params.items,
    baseAmount: params.baseAmount,
    memberMenuItemIds: params.memberMenuItemIds,
  });
}

/**
 * ── Aplica beneficios de membresía a una orden (cualquier método de pago) ──
 *   · MEMBER_CONSUMPTION → ítems marcados del socio, sin costo
 *   · INCLUDED_PRODUCT   → 1 unidad gratis del platillo (debe estar en la cuenta)
 *   · DISCOUNT_PCT       → % sobre el neto restante
 *   · CREDIT_BALANCE     → pago parcial con el saldo del pase (nunca cubre el 100%)
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
  /** Ítems del carrito que son consumo del socio (MEMBER_CONSUMPTION). */
  memberMenuItemIds?: string[];
  /** Monto antes de impuestos sobre el que se calculan descuentos. */
  baseAmount: number;
}): Promise<{
  finalAmount: number;
  discount: number;
  creditApplied: number;
  compensations: Array<() => Promise<unknown>>;
  lines: BenefitLine[];
}> {
  const compensations: Array<() => Promise<unknown>> = [];
  if (!params.entitlementIds?.length) {
    return {
      finalAmount: round(Math.max(0, Number(params.baseAmount) || 0)),
      discount: 0,
      creditApplied: 0,
      compensations,
      lines: [],
    };
  }

  const { loaded } = await loadValidatedEntitlements(params);

  // Reset perezoso del ciclo: sin esto, tras la primera semana la cuota quedaba
  // en 0 para siempre.
  const now = new Date();
  for (const item of loaded) {
    const { ent } = item;
    if (ent.cycleResetType !== "FIXED" && ent.cycleEndDate && new Date(ent.cycleEndDate) <= now) {
      const nextEnd = nextCycleEnd(now, ent.cycleResetType);
      await params.coreDb
        .update(membershipEntitlements)
        .set({ currentUsageInCycle: 0, cycleStartDate: now, cycleEndDate: nextEnd })
        .where(
          and(
            eq(membershipEntitlements.id, ent.id),
            lt(membershipEntitlements.cycleEndDate, now),
          ),
        );
      ent.currentUsageInCycle = 0;
      ent.cycleEndDate = nextEnd;
    }
  }

  // Reintentos: lo ya consumido para esta orden no se vuelve a cobrar.
  const skipIds = new Set<string>();
  for (const { ent } of loaded) {
    const usageKey = `ord_${params.orderId}_ent_${ent.id}`;
    const [priorUse] = await params.coreDb
      .select({ id: entitlementUsages.id })
      .from(entitlementUsages)
      .where(eq(entitlementUsages.idempotencyKey, usageKey))
      .limit(1);
    if (priorUse) skipIds.add(ent.id);
  }

  const plan = computeBenefitPlan({
    loaded,
    items: params.items,
    baseAmount: params.baseAmount,
    memberMenuItemIds: params.memberMenuItemIds,
    skipIds,
  });

  // Un beneficio agotado solo rompe el cobro si de verdad aplicaría a esta
  // cuenta; si no aplica (p. ej. el producto no está), se ignora.
  for (const line of plan.lines) {
    if (!line.exhausted) continue;
    const item = loaded.find((l) => l.ent.id === line.entitlementId);
    if (!item) continue;
    const probe = computeBenefitPlan({
      loaded: [{ ent: { ...item.ent, currentUsageInCycle: 0 }, sub: item.sub }],
      items: params.items,
      baseAmount: round(Math.max(0, Number(params.baseAmount) || 0)),
      memberMenuItemIds: params.memberMenuItemIds,
    });
    if ((probe.lines[0]?.applied ?? 0) > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "El beneficio no tiene usos disponibles este ciclo.",
      });
    }
  }

  for (const line of plan.lines) {
    if (line.applied <= 0 || skipIds.has(line.entitlementId)) continue;

    const { ent } = loaded.find((l) => l.ent.id === line.entitlementId)!;
    const usageKey = `ord_${params.orderId}_ent_${ent.id}`;

    if (ent.benefitType === "CREDIT_BALANCE") {
      const res = await params.coreDb
        .update(membershipEntitlements)
        .set({
          creditBalance: sql`GREATEST(0, COALESCE(${membershipEntitlements.creditBalance}, 0) - ${line.applied})`,
        })
        .where(
          and(
            eq(membershipEntitlements.id, ent.id),
            sql`COALESCE(${membershipEntitlements.creditBalance}, 0) >= ${line.applied}`,
          ),
        )
        .returning({ id: membershipEntitlements.id });
      if (res.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El saldo de la membresía cambió — revisa y vuelve a aplicar.",
        });
      }
      compensations.push(() =>
        params.coreDb
          .update(membershipEntitlements)
          .set({
            creditBalance: sql`COALESCE(${membershipEntitlements.creditBalance}, 0) + ${line.applied}`,
          })
          .where(eq(membershipEntitlements.id, ent.id)),
      );
    } else {
      const res = await params.coreDb
        .update(membershipEntitlements)
        .set({
          currentUsageInCycle: sql`COALESCE(${membershipEntitlements.currentUsageInCycle}, 0) + 1`,
        })
        .where(
          and(
            eq(membershipEntitlements.id, ent.id),
            sql`COALESCE(${membershipEntitlements.currentUsageInCycle}, 0) < COALESCE(${membershipEntitlements.quotaPerCycle}, 2147483647)`,
          ),
        )
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
          .set({
            currentUsageInCycle: sql`GREATEST(0, COALESCE(${membershipEntitlements.currentUsageInCycle}, 0) - 1)`,
          })
          .where(eq(membershipEntitlements.id, ent.id));
        await params.coreDb
          .delete(entitlementUsages)
          .where(eq(entitlementUsages.idempotencyKey, usageKey));
      });
    }

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

  return {
    finalAmount: plan.finalAmount,
    discount: plan.discount,
    creditApplied: plan.creditApplied,
    compensations,
    lines: plan.lines,
  };
}
