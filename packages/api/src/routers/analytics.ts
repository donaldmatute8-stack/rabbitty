import { z } from "zod";
import { router, protectedProcedure, resolveBranchId } from "../trpc";
import { and, desc, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { orders, orderItems, menuItems, payments, branches, customers, restaurants, paymentIntents } from "@rabbitty/database-restaurant/schema";

// ─── ZONA HORARIA DEL NEGOCIO ──────────────────────────────────────────────
// Los reportes financieros y por hora se agrupan por el día/hora LOCAL del
// comercio (default America/Mexico_City), NO por UTC del servidor. Esto evita
// que ventas/gastos registrados en la tarde-noche caigan al día equivocado.
const BUSINESS_TZ = process.env.BUSINESS_TZ || "America/Mexico_City";

const tzPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

/** Retorna fecha local del negocio "YYYY-MM-DD" y hora 0-23 para un instante. */
function tzDayAndHour(d: Date): { date: string; hour: number } {
  try {
    const parts = tzPartsFormatter.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = parseInt(get("hour"), 10) % 24;
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour };
  } catch {
    const dt = new Date(d.getTime() - 6 * 60 * 60 * 1000); // fallback manual CST
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, hour: dt.getHours() };
  }
}

/** Convierte una fecha local del negocio "YYYY-MM-DD" al intervalo real [inicio, fin). */
function localDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - 6); // CST (UTC-6, México sin DST desde 2022)
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function effectiveDateRange(
  input: { days?: number | null; from?: string | null; to?: string | null }
): { startDate: Date; endDate: Date | null; perDayInit: boolean } {
  if (input.from && input.to) {
    const { start } = localDayRange(input.from);
    const { end } = localDayRange(input.to);
    return { startDate: start, endDate: end, perDayInit: false };
  }
  const days = input.days ?? 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return { startDate: d, endDate: null, perDayInit: true };
}

/**
 * ── Plan "Analíticas Pro" (vendible, apagado por defecto) ──
 * Cuando el comercio lo activa (Ajustes → Facturación), los procs *_Pro
 * regresan datos; si no, regresan { gated: true } con la tasa de teaser.
 */
async function isAnalyticsProEnabled(restaurantDb: any, restaurantId: string): Promise<boolean> {
  try {
    const [row] = await restaurantDb
      .select({ pro: restaurants.analyticsProEnabled })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);
    return Boolean(row?.pro);
  } catch {
    return false; // sin la columna o error: apagado (safe-by-default)
  }
}

const PRO_GATED = {
  gated: true as const,
  teaser: "Métrica disponible en el plan Analíticas Pro — actívala en Ajustes → Facturación.",
};

export const analyticsRouter = router({
  getSalesTrends: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        days: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, perDayInit } = effectiveDateRange(input);

      // Local date string helper — en la timezone del NEGOCIO (no del servidor)
      const toLocalDateStr = (d: Date) => tzDayAndHour(d).date;

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, await resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate)
          )
        );

      // Group by date — include tax and base breakdown for fiscal reconciliation
      type DayBucket = { totalSales: number; taxTotal: number; baseTotal: number };
      const dailySalesMap = new Map<string, DayBucket>();
      
      // Initialize daily sales map with all days in range to avoid gaps (solo en modo presets)
      if (perDayInit) {
        for (let i = (input.days ?? 30) - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dailySalesMap.set(toLocalDateStr(d), { totalSales: 0, taxTotal: 0, baseTotal: 0 });
        }
      }

      for (const order of ordersList) {
        if (!order.createdAt) continue;
        const dateStr = toLocalDateStr(order.createdAt);
        const bucket = dailySalesMap.get(dateStr) ?? { totalSales: 0, taxTotal: 0, baseTotal: 0 };
        bucket.totalSales += Number(order.total) || 0;
        bucket.taxTotal += Number(order.tax) || 0;
        bucket.baseTotal += Number(order.subtotal) || 0;
        dailySalesMap.set(dateStr, bucket);
      }

      const trends = Array.from(dailySalesMap.entries()).map(([date, bucket]) => ({
        date,
        totalSales: Math.round(bucket.totalSales * 100) / 100,
        taxTotal: Math.round(bucket.taxTotal * 100) / 100,
        baseTotal: Math.round(bucket.baseTotal * 100) / 100,
      })).sort((a, b) => a.date.localeCompare(b.date));

      return trends;
    }),

  getHourlySales: protectedProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        days: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (input.days ?? 7));

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, await resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate)
          )
        );

      const hourlySales = Array(24).fill(0).map((_, hour) => ({ hour, sales: 0, orderCount: 0 }));

      for (const order of ordersList) {
        if (!order.createdAt) continue;
        // Hora local del negocio (no getHours del servidor, que es UTC en Vercel)
        const hour = tzDayAndHour(order.createdAt).hour;
        hourlySales[hour]!.sales += (Number(order.total) || 0);
        hourlySales[hour]!.orderCount += 1;
      }

      return hourlySales;
    }),

  getTopProducts: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        limit: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, await resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"])
          )
        );

      if (ordersList.length === 0) return [];
      const orderIds = ordersList.map((o) => o.id);

      const itemsList = await ctx.restaurantDb
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));

      const menuItemsList = await ctx.restaurantDb
        .select()
        .from(menuItems)
        .where(eq(menuItems.branchId, await resolveBranchId(ctx, input.branchId)));

      const productRevenueMap = new Map<string, number>();
      for (const item of itemsList) {
        // Skip voided items
        if (item.status === "VOIDED" || item.voidedAt) continue;
        const menuItem = menuItemsList.find((mi) => mi.id === item.menuItemId);
        const name = menuItem?.name || `Item ${item.menuItemId}`;
        const rev = productRevenueMap.get(name) || 0;
        productRevenueMap.set(name, rev + (Number(item.totalPrice) || 0));
      }

      const result = Array.from(productRevenueMap.entries())
        .map(([name, revenue]) => ({
          name,
          revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, input.limit);

      return result;
    }),

  getPaymentMethods: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        days: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = effectiveDateRange(input);

      // Same rule as the cash register (computeShiftTotals): COMPLETED payments
      // of the branch, bucketed by payment date, regardless of order status
      // (so partially paid orders are counted too).
      const paymentsList = await ctx.restaurantDb
        .select({ method: payments.method, amount: payments.amount })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(orders.branchId, await resolveBranchId(ctx, input.branchId)),
            eq(payments.status, "COMPLETED"),
            gte(payments.createdAt, startDate),
            ...(endDate ? [lte(payments.createdAt, endDate)] : [])
          )
        );

      if (paymentsList.length === 0) return [];

      const methodMap = new Map<string, number>();
      for (const pay of paymentsList) {
        let method = pay.method;
        if (method === "CREDIT_CARD" || method === "DEBIT_CARD") {
          method = "Tarjeta";
        } else if (method === "CASH") {
          method = "Efectivo";
        } else if (method === "BUNZ") {
          method = "Bunz";
        }

        const amt = methodMap.get(method) || 0;
        methodMap.set(method, amt + (Number(pay.amount) || 0));
      }

      return Array.from(methodMap.entries()).map(([method, amount]) => ({
        method,
        amount: Math.round((amount + Number.EPSILON) * 100) / 100,
      }));
    }),

  getExportData: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        days: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = effectiveDateRange(input);

      const [branch] = await ctx.restaurantDb
        .select()
        .from(branches)
        .where(eq(branches.id, await resolveBranchId(ctx, input.branchId)));
      if (!branch) return [];

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, await resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate),
            ...(endDate ? [lte(orders.createdAt, endDate)] : [])
          )
        );

      const customersList = await ctx.restaurantDb
        .select()
        .from(customers)
        .where(eq(customers.restaurantId, branch.restaurantId));

      return ordersList.map((order) => {
        const customer = order.customerPhone
          ? customersList.find((c) => c.phone === order.customerPhone)
          : null;
        return {
          orderId: order.id,
          date: order.createdAt,
          customerSegment: customer?.segment || "General",
          subtotal: Number(order.subtotal) || 0,
          tax: Number(order.tax) || 0,
          discount: Number(order.discount) || 0,
          bunzPaid: Number(order.bunzPaid) || 0,
          total: Number(order.total) || 0,
          cfdiStatus: order.cfdiStatus,
        };
      });
    }),

  // ═══════════ ANALÍTICAS PRO (plan vendible — apagado por defecto) ═══════════

  /** 💡 Conversión de cobro digital y checkouts abandonados (dinerito perdido). */
  getCheckoutConversionPro: protectedProcedure
    .input(z.object({ branchId: z.string(), days: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const [branch] = await ctx.restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, branchId));
      if (!branch || !(await isAnalyticsProEnabled(ctx.restaurantDb, branch.restaurantId))) {
        return PRO_GATED;
      }
      const { startDate } = effectiveDateRange(input);
      const intents = await ctx.restaurantDb
        .select({ status: paymentIntents.status, count: sql<number>`COUNT(*)` })
        .from(paymentIntents)
        .where(and(gte(paymentIntents.createdAt, startDate), eq(paymentIntents.merchantId, branchId)))
        .groupBy(paymentIntents.status);
      const byStatus = intents.reduce<Record<string, number>>((acc, r) => { acc[r.status] = Number(r.count); return acc; }, {});
      const total = Object.values(byStatus).reduce((s, n) => s + n, 0);
      const settled = (byStatus["SUCCEEDED"] ?? 0) + (byStatus["PROCESSING"] ?? 0);
      const abandonedRows = await ctx.restaurantDb
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentIntents)
        .where(and(
          inArray(paymentIntents.status, ["PENDING_PAYMENT", "REQUIRES_ACTION"]),
          sql`${paymentIntents.createdAt} < NOW() - INTERVAL '2 hours'`,
          eq(paymentIntents.merchantId, branchId)
        ));
      return {
        gated: false as const,
        total,
        byStatus,
        settled,
        failed: (byStatus["EXPIRED"] ?? 0) + (byStatus["CANCELLED"] ?? 0) + (byStatus["FAILED"] ?? 0),
        conversion: total > 0 ? Math.round((settled / total) * 1000) / 10 : 0,
        abandoned: Number(abandonedRows[0]?.count || 0),
      };
    }),

  /** Propinas del período (cuenta vs propina separadas — visible para admin, sin gate de plan). */
  getTipsSummary: protectedProcedure
    .input(z.object({ branchId: z.string(), days: z.number().optional(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const branchId = await resolveBranchId(ctx, input.branchId);
      const { startDate, endDate } = effectiveDateRange(input);
      const rows = await ctx.restaurantDb
        .select({ method: payments.method, amount: payments.amount, tipAmount: payments.tipAmount, createdAt: payments.createdAt })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(and(
          eq(orders.branchId, branchId),
          eq(payments.status, "COMPLETED"),
          gte(payments.createdAt, startDate),
          ...(endDate ? [lte(payments.createdAt, endDate)] : [])
        ));
      const tipRows = rows.filter((r) => Number(r.tipAmount || 0) > 0);
      const totalTip = r2(tipRows.reduce((s, r) => s + Number(r.tipAmount || 0), 0));
      const cashTip = r2(tipRows.filter((r) => r.method === "CASH").reduce((s, r) => s + Number(r.tipAmount || 0), 0));
      const cardTip = r2(totalTip - cashTip);
      const totalSales = r2(rows.reduce((s, r) => s + Number(r.amount || 0), 0));
      return {
        totalTip,
        cashTip,
        cardTip,
        tippedPayments: tipRows.length,
        totalPayments: rows.length,
        tipSharePct: totalSales > 0 ? Math.round((totalTip / totalSales) * 1000) / 10 : 0,
      };
    }),

  /** 💡 Propinas (plan Pro): cuántas mesas dan, cuánto promedian y qué % del total. */
  getTipsAnalyticsPro: protectedProcedure
    .input(z.object({ branchId: z.string(), days: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const [branch] = await ctx.restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, branchId));
      if (!branch || !(await isAnalyticsProEnabled(ctx.restaurantDb, branch.restaurantId))) {
        return PRO_GATED;
      }
      const { startDate } = effectiveDateRange(input);
      const [stats] = await ctx.restaurantDb
        .select({
          paidOrders: sql<number>`COUNT(*)`,
          withTip: sql<number>`COUNT(*) FILTER (WHERE ${orders.tip} > 0)`,
          totalTip: sql<number>`COALESCE(SUM(${orders.tip}), 0)`,
          avgTipPct: sql<number>`COALESCE(AVG(CASE WHEN ${orders.tip} > 0 AND ${orders.subtotal} > 0 THEN (${orders.tip} / ${orders.subtotal}) * 100 END), 0)`,
        })
        .from(orders)
        .where(and(inArray(orders.status, ["COMPLETED", "PAID"]), gte(orders.createdAt, startDate)));
      return {
        gated: false as const,
        paidOrders: Number(stats?.paidOrders || 0),
        ordersWithTip: Number(stats?.withTip || 0),
        totalTip: Number(stats?.totalTip || 0),
        avgTipPct: Math.round(Number(stats?.avgTipPct || 0) * 10) / 10,
      };
    }),

  /** 💡 Tendencia semanal por método de pago (12 semanas). */
  getWeeklyMethodTrendPro: protectedProcedure
    .input(z.object({ branchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const [branch] = await ctx.restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, branchId));
      if (!branch || !(await isAnalyticsProEnabled(ctx.restaurantDb, branch.restaurantId))) {
        return PRO_GATED;
      }
      const rows = await ctx.restaurantDb
        .select({
          week: sql<string>`to_char(date_trunc('week', ${payments.createdAt}), 'DD Mon')`,
          method: payments.method,
          wk: sql<string>`date_trunc('week', ${payments.createdAt})::text`,
          total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(and(eq(orders.branchId, branchId), eq(payments.status, "COMPLETED"), gte(payments.createdAt, sql`NOW() - (INTERVAL '1 day' * 84)`)))
        .groupBy(sql`date_trunc('week', ${payments.createdAt})`, payments.method)
        .orderBy(sql`date_trunc('week', ${payments.createdAt})`);
      return {
        gated: false as const,
        weekly: rows.map((r) => ({ week: r.week, wk: r.wk, method: r.method, total: Number(r.total) })),
      };
    }),

  /** 💡 Crecimiento de TU clientela: nuevos vs recurrentes por mes. */
  getCustomerGrowthPro: protectedProcedure
    .input(z.object({ branchId: z.string(), months: z.number().int().min(3).max(24).default(12) }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const [branch] = await ctx.restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, branchId));
      if (!branch || !(await isAnalyticsProEnabled(ctx.restaurantDb, branch.restaurantId))) {
        return PRO_GATED;
      }
      const newRows = await ctx.restaurantDb
        .select({
          month: sql<string>`to_char(date_trunc('month', ${customers.createdAt}), 'Mon YY')`,
          mo: sql<string>`date_trunc('month', ${customers.createdAt})::text`,
          count: sql<number>`COUNT(*)`,
        })
        .from(customers)
        .where(and(eq(customers.restaurantId, branch.restaurantId), gte(customers.createdAt, sql`NOW() - (INTERVAL '1 month' * ${input.months})`)))
        .groupBy(sql`date_trunc('month', ${customers.createdAt})`)
        .orderBy(sql`date_trunc('month', ${customers.createdAt})`);
      const [repeat] = await ctx.restaurantDb
        .select({
          total: sql<number>`COUNT(*)`,
          recurring: sql<number>`COUNT(*) FILTER (WHERE ${customers.totalVisits} > 1)`,
        })
        .from(customers)
        .where(eq(customers.restaurantId, branch.restaurantId));
      return {
        gated: false as const,
        newByMonth: newRows.map((r) => ({ month: r.month, new: Number(r.count) })),
        base: {
          totalCustomers: Number(repeat?.total || 0),
          recurring: Number(repeat?.recurring || 0),
          recurringPct: Number(repeat?.total || 0) > 0
            ? Math.round((Number(repeat?.recurring || 0) / Number(repeat?.total || 1)) * 100)
            : 0,
        },
      };
    }),
});
