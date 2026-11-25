import { settledPaymentStatuses } from "../services/payments/settled";
import { z } from "zod";
import { router, protectedProcedure, resolveBranchId } from "../trpc";
import { and, asc, desc, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { orders, orderItems, menuItems, menuCategories, payments, branches, customers, restaurants, paymentIntents, staff as staffTable, staffShifts, rabbitChairSlots, rabbitChairActivations } from "@rabbitty/database-restaurant/schema";

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
            gte(orders.createdAt, startDate),
            ...(endDate ? [lte(orders.createdAt, endDate)] : [])
          )
        );

      // Group by date — include tax and base breakdown for fiscal reconciliation
      type DayBucket = { totalSales: number; taxTotal: number; baseTotal: number; orderCount: number };
      const dailySalesMap = new Map<string, DayBucket>();
      
      // Initialize daily sales map with all days in range to avoid gaps (solo en modo presets)
      if (perDayInit) {
        for (let i = (input.days ?? 30) - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dailySalesMap.set(toLocalDateStr(d), { totalSales: 0, taxTotal: 0, baseTotal: 0, orderCount: 0 });
        }
      }

      for (const order of ordersList) {
        if (!order.createdAt) continue;
        const dateStr = toLocalDateStr(order.createdAt);
        const bucket = dailySalesMap.get(dateStr) ?? { totalSales: 0, taxTotal: 0, baseTotal: 0, orderCount: 0 };
        bucket.totalSales += Number(order.total) || 0;
        bucket.taxTotal += Number(order.tax) || 0;
        bucket.baseTotal += Number(order.subtotal) || 0;
        bucket.orderCount += 1;
        dailySalesMap.set(dateStr, bucket);
      }

      const trends = Array.from(dailySalesMap.entries()).map(([date, bucket]) => ({
        date,
        totalSales: Math.round(bucket.totalSales * 100) / 100,
        taxTotal: Math.round(bucket.taxTotal * 100) / 100,
        baseTotal: Math.round(bucket.baseTotal * 100) / 100,
        orderCount: bucket.orderCount,
      })).sort((a, b) => a.date.localeCompare(b.date));

      return trends;
    }),

  getHourlySales: protectedProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        days: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = effectiveDateRange(input);

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
        limit: z.number().optional().default(10),
        days: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const { startDate, endDate } = effectiveDateRange(input);

      const ordersList = await ctx.restaurantDb
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.branchId, branchId),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate),
            ...(endDate ? [lte(orders.createdAt, endDate)] : [])
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
        .where(eq(menuItems.branchId, branchId));

      const categoriesList = await ctx.restaurantDb
        .select({ id: menuCategories.id, name: menuCategories.name })
        .from(menuCategories)
        .where(eq(menuCategories.branchId, branchId));
      const categoryById = new Map(categoriesList.map((c) => [c.id, c.name]));

      const drinkPattern = /bebida|cafe|café|refresco|cerveza|vino|coctel|cóctel|agua|te|té|jugo|smoothie|frappe|latte|capuchino|espresso|barra|mixolog/i;

      type ProductRow = {
        name: string;
        quantity: number;
        revenue: number;
        category: string;
        isDrink: boolean;
      };
      const productMap = new Map<string, ProductRow>();

      for (const item of itemsList) {
        if (item.status === "VOIDED" || item.voidedAt) continue;
        const menuItem = menuItemsList.find((mi) => mi.id === item.menuItemId);
        const name = menuItem?.name || `Item ${item.menuItemId}`;
        const category = menuItem ? categoryById.get(menuItem.categoryId) || "Sin categoría" : "Sin categoría";
        const key = `${name}::${category}`;
        const current = productMap.get(key) ?? {
          name,
          quantity: 0,
          revenue: 0,
          category,
          isDrink: drinkPattern.test(`${category} ${name}`),
        };
        current.quantity += Number(item.quantity) || 0;
        current.revenue += Number(item.totalPrice) || 0;
        productMap.set(key, current);
      }

      return Array.from(productMap.values())
        .map((row) => ({
          ...row,
          revenue: Math.round((row.revenue + Number.EPSILON) * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, input.limit);
    }),

  getTopCustomers: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        days: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const { startDate, endDate } = effectiveDateRange(input);

      const rows = await ctx.restaurantDb
        .select({
          customerPhone: orders.customerPhone,
          customerName: orders.customerName,
          total: sql<number>`coalesce(sum(${orders.total}), 0)`,
          orderCount: sql<number>`count(*)::int`,
          lastVisit: sql<Date>`max(${orders.createdAt})`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.branchId, branchId),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate),
            ...(endDate ? [lte(orders.createdAt, endDate)] : []),
            sql`${orders.customerPhone} IS NOT NULL`
          )
        )
        .groupBy(orders.customerPhone, orders.customerName)
        .orderBy(desc(sql`coalesce(sum(${orders.total}), 0)`))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r,
        total: Math.round(Number(r.total) * 100) / 100,
      }));
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
            settledPaymentStatuses(),
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


  // ── Reporte por producto (contabilidad / administración) ──────────────────
  /** Catálogo unificado para el selector: platillos y productos de tienda. */
  listReportProducts: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const rows = await ctx.restaurantDb
        .select({
          id: menuItems.id,
          name: menuItems.name,
          kind: menuItems.kind,
          price: menuItems.price,
          cost: menuItems.cost,
          category: menuCategories.name,
          isActive: menuItems.isActive,
        })
        .from(menuItems)
        .leftJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(eq(menuItems.branchId, branchId))
        .orderBy(asc(menuItems.name));
      // El placeholder "La Silla" (categoría Rabbit Chair, inactivo) no debe
      // aparecer en el selector: tiene su propio reporte. Sigue en el reporte
      // cuando se filtra por canal RABBIT_CHAIR.
      return rows.filter(
        (row) => !(row.category === "Rabbit Chair" && row.isActive === false),
      );
    }),

  /**
   * Reporte por producto y rango: unidades, ingreso, costo, margen e IVA,
   * con serie diaria y desglose por canal y método de pago.
   * scope = branch (sucursal) | business (consolidado del tenant).
   */
  getProductReport: protectedProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        scope: z.enum(["branch", "business"]).default("branch"),
        from: z.string().optional(),
        to: z.string().optional(),
        days: z.number().optional(),
        productIds: z.array(z.string()).optional(),
        kind: z.enum(["DISH", "PRODUCT"]).optional(),
        channel: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);
      if (!branch) return { products: [], series: [], channels: [], methods: [], totals: null };

      const branchIds =
        input.scope === "business"
          ? (
              await ctx.restaurantDb
                .select({ id: branches.id })
                .from(branches)
                .where(and(eq(branches.restaurantId, branch.restaurantId), eq(branches.isActive, true)))
            ).map((b) => b.id)
          : [branchId];

      const { startDate, endDate } = effectiveDateRange(input);

      const channelFilter =
        input.channel && input.channel !== "ALL"
          ? input.channel === "POS"
            ? sql`(${orders.channel} IS NULL OR ${orders.channel} = 'POS')`
            : input.channel === "APP"
              ? sql`(${orders.channel} = 'APP' OR (${orders.channel} IS NULL AND ${orders.customerId} IS NOT NULL))`
              : eq(orders.channel, input.channel)
          : undefined;

      const ordersList = await ctx.restaurantDb
        .select({
          id: orders.id,
          tax: orders.tax,
          subtotal: orders.subtotal,
          channel: orders.channel,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            inArray(orders.branchId, branchIds),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate),
            ...(endDate ? [lte(orders.createdAt, endDate)] : []),
            ...(channelFilter ? [channelFilter] : []),
          ),
        );

      if (ordersList.length === 0) {
        return { products: [], series: [], channels: [], methods: [], totals: null };
      }

      const orderIds = ordersList.map((o) => o.id);
      const orderById = new Map(ordersList.map((o) => [o.id, o]));

      const itemsList = await ctx.restaurantDb
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));

      const menuList = await ctx.restaurantDb
        .select({
          id: menuItems.id,
          name: menuItems.name,
          kind: menuItems.kind,
          cost: menuItems.cost,
          category: menuCategories.name,
        })
        .from(menuItems)
        .leftJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(inArray(menuItems.branchId, branchIds));
      const menuById = new Map(menuList.map((m) => [m.id, m]));

      const payList = await ctx.restaurantDb
        .select({ orderId: payments.orderId, method: payments.method })
        .from(payments)
        .where(inArray(payments.orderId, orderIds));
      const methodsByOrder = new Map<string, string[]>();
      for (const pay of payList) {
        const list = methodsByOrder.get(pay.orderId) ?? [];
        list.push(pay.method);
        methodsByOrder.set(pay.orderId, list);
      }

      // ── La Silla: costo del staff extra prorrateado por lugar vendido ──
      // El aporte no tiene COGS; el único costo real es el empleado extra
      // (bartender/barista) congelado en la activación.
      const chairSlots = await ctx.restaurantDb
        .select({ orderId: rabbitChairSlots.orderId, activationId: rabbitChairSlots.activationId })
        .from(rabbitChairSlots)
        .where(inArray(rabbitChairSlots.orderId, orderIds));
      const chairCostByOrder = new Map<string, number>();
      const chairActivationIds = Array.from(
        new Set(chairSlots.map((slot) => String(slot.activationId))),
      );
      if (chairActivationIds.length > 0) {
        const chairActivations = await ctx.restaurantDb
          .select({
            id: rabbitChairActivations.id,
            staffCostCents: rabbitChairActivations.staffCostCents,
          })
          .from(rabbitChairActivations)
          .where(inArray(rabbitChairActivations.id, chairActivationIds));
        const soldRows = await ctx.restaurantDb
          .select({
            activationId: rabbitChairSlots.activationId,
            count: sql<number>`count(*)::int`,
          })
          .from(rabbitChairSlots)
          .where(
            and(
              inArray(rabbitChairSlots.activationId, chairActivationIds),
              inArray(rabbitChairSlots.status, ["PAID", "SEATED", "SERVED", "DONE"]),
            ),
          )
          .groupBy(rabbitChairSlots.activationId);
        const soldByActivation = new Map(
          soldRows.map((row) => [String(row.activationId), Number(row.count ?? 0)]),
        );
        const costPerSeat = new Map<string, number>();
        for (const chair of chairActivations) {
          const sold = Math.max(1, soldByActivation.get(String(chair.id)) ?? 1);
          costPerSeat.set(String(chair.id), Number(chair.staffCostCents ?? 0) / 100 / sold);
        }
        for (const slot of chairSlots) {
          const order = orderById.get(String(slot.orderId));
          if (!order || order.channel !== "RABBIT_CHAIR") continue;
          chairCostByOrder.set(
            String(slot.orderId),
            costPerSeat.get(String(slot.activationId)) ?? 0,
          );
        }
      }

      const [restaurant] = await ctx.restaurantDb
        .select({ taxRate: restaurants.taxRate })
        .from(restaurants)
        .where(eq(restaurants.id, branch.restaurantId))
        .limit(1);
      const defaultRate = Number(restaurant?.taxRate ?? 0.16);

      const productMap = new Map<
        string,
        { name: string; kind: string; category: string; qty: number; revenue: number; cost: number; tax: number }
      >();
      const seriesMap = new Map<string, { date: string; revenue: number; qty: number }>();
      const channelMap = new Map<string, { revenue: number; qty: number }>();
      const methodMap = new Map<string, { revenue: number; qty: number }>();

      for (const item of itemsList) {
        if (item.status === "VOIDED" || item.voidedAt) continue;
        const order = orderById.get(item.orderId);
        if (!order) continue;
        const menu = menuById.get(item.menuItemId);
        const name = item.nameSnapshot || menu?.name || "Artículo";
        const key = `${menu?.id ?? "snap"}::${name}`;
        const qty = Number(item.quantity) || 0;
        const lineTotal = Number(item.totalPrice) || 0;
        const rate =
          Number(order.tax) > 0 && Number(order.subtotal) > 0
            ? Number(order.tax) / Number(order.subtotal)
            : defaultRate;
        const tax =
          item.taxAmount != null
            ? Number(item.taxAmount)
            : Math.round((lineTotal - lineTotal / (1 + rate)) * 100) / 100;

        if (input.productIds?.length) {
          const matches = input.productIds.includes(String(item.menuItemId)) || input.productIds.includes(key);
          if (!matches) continue;
        }
        if (input.kind && (menu?.kind ?? "DISH") !== input.kind) continue;

        const current = productMap.get(key) ?? {
          name,
          kind: menu?.kind ?? "DISH",
          category: menu?.category ?? "Sin categoría",
          qty: 0,
          revenue: 0,
          cost: 0,
          tax: 0,
        };
        const chairCost = chairCostByOrder.get(String(item.orderId));
        current.qty += qty;
        current.revenue += lineTotal;
        current.cost += (chairCost ?? Number(menu?.cost ?? 0)) * qty;
        current.tax += tax;
        productMap.set(key, current);

        const { date } = tzDayAndHour(new Date(order.createdAt as unknown as string));
        const day = seriesMap.get(date) ?? { date, revenue: 0, qty: 0 };
        day.revenue += lineTotal;
        day.qty += qty;
        seriesMap.set(date, day);

        const channelKey = String(order.channel || "POS");
        const channelRow = channelMap.get(channelKey) ?? { revenue: 0, qty: 0 };
        channelRow.revenue += lineTotal;
        channelRow.qty += qty;
        channelMap.set(channelKey, channelRow);

        for (const method of methodsByOrder.get(order.id) ?? ["SIN_PAGO"]) {
          const methodRow = methodMap.get(method) ?? { revenue: 0, qty: 0 };
          methodRow.revenue += lineTotal;
          methodRow.qty += qty;
          methodMap.set(method, methodRow);
        }
      }

      const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
      const products = Array.from(productMap.values())
        .map((row) => ({
          ...row,
          revenue: round2(row.revenue),
          cost: round2(row.cost),
          tax: round2(row.tax),
          margin: round2(row.revenue - row.cost),
          marginPct: row.revenue > 0 ? Math.round(((row.revenue - row.cost) / row.revenue) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const totals = products.reduce(
        (acc, p) => {
          acc.qty += p.qty;
          acc.revenue += p.revenue;
          acc.cost += p.cost;
          acc.tax += p.tax;
          acc.margin += p.margin;
          return acc;
        },
        { qty: 0, revenue: 0, cost: 0, tax: 0, margin: 0 },
      );

      return {
        products,
        series: Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        channels: Array.from(channelMap.entries()).map(([channel, v]) => ({ channel, ...v })),
        methods: Array.from(methodMap.entries()).map(([method, v]) => ({ method, ...v })),
        totals: {
          ...totals,
          revenue: round2(totals.revenue),
          cost: round2(totals.cost),
          tax: round2(totals.tax),
          margin: round2(totals.margin),
          marginPct: totals.revenue > 0 ? Math.round((totals.margin / totals.revenue) * 100) : 0,
        },
      };
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
      const settled = (byStatus["SUCCEEDED"] ?? 0) + (byStatus["SETTLED"] ?? 0) + (byStatus["PROCESSING"] ?? 0);
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
  /**
   * Costos de personal del período: horas trabajadas (reloj checador), costo
   * laboral (tarifa × horas), comisión sobre ventas y propinas por empleado.
   * Solo lectura: no mueve dinero.
   */
  getStaffCosts: protectedProcedure
    .input(z.object({ branchId: z.string(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const branchId = await resolveBranchId(ctx, input.branchId);
      const { startDate, endDate } = effectiveDateRange(input);

      const people = await ctx.restaurantDb
        .select({
          id: staffTable.id,
          name: staffTable.name,
          role: staffTable.role,
          hourlyRate: staffTable.hourlyRate,
          commissionPct: staffTable.commissionPct,
        })
        .from(staffTable)
        .where(eq(staffTable.branchId, branchId))
        .orderBy(staffTable.name);

      const shifts = await ctx.restaurantDb
        .select({ staffId: staffShifts.staffId, checkIn: staffShifts.checkIn, checkOut: staffShifts.checkOut })
        .from(staffShifts)
        .where(
          and(
            eq(staffShifts.branchId, branchId),
            gte(staffShifts.checkIn, startDate),
            ...(endDate ? [lte(staffShifts.checkIn, endDate)] : []),
          ),
        );

      const sales = await ctx.restaurantDb
        .select({
          staffId: orders.staffId,
          tickets: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
          tips: sql<number>`COALESCE(SUM(${payments.tipAmount}), 0)`,
        })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(orders.branchId, branchId),
            settledPaymentStatuses(),
            gte(payments.createdAt, startDate),
            ...(endDate ? [lte(payments.createdAt, endDate)] : []),
          ),
        )
        .groupBy(orders.staffId);

      const salesByStaff = new Map(
        sales.map((s) => [
          s.staffId ?? "",
          { tickets: Number(s.tickets), revenue: Number(s.revenue), tips: Number(s.tips) },
        ]),
      );

      const now = Date.now();
      const rows = people.map((p) => {
        const hours = shifts
          .filter((s) => s.staffId === p.id)
          .reduce((sum, s) => {
            const end = s.checkOut ? new Date(s.checkOut).getTime() : now;
            return sum + Math.max(0, (end - new Date(s.checkIn).getTime()) / 3_600_000);
          }, 0);
        const sale = salesByStaff.get(p.id) ?? { tickets: 0, revenue: 0, tips: 0 };
        const laborCost = hours * Number(p.hourlyRate || 0);
        const commission = sale.revenue * (Number(p.commissionPct || 0) / 100);
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          hours: r2(hours),
          hourlyRate: Number(p.hourlyRate || 0),
          laborCost: r2(laborCost),
          tickets: sale.tickets,
          revenue: r2(sale.revenue),
          commissionPct: Number(p.commissionPct || 0),
          commission: r2(commission),
          tips: r2(sale.tips),
          totalCost: r2(laborCost + commission),
        };
      });

      return {
        staff: rows,
        totals: {
          hours: r2(rows.reduce((s, r) => s + r.hours, 0)),
          laborCost: r2(rows.reduce((s, r) => s + r.laborCost, 0)),
          revenue: r2(rows.reduce((s, r) => s + r.revenue, 0)),
          commission: r2(rows.reduce((s, r) => s + r.commission, 0)),
          tips: r2(rows.reduce((s, r) => s + r.tips, 0)),
          totalCost: r2(rows.reduce((s, r) => s + r.totalCost, 0)),
        },
      };
    }),

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
          settledPaymentStatuses(),
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
        .where(and(eq(orders.branchId, branchId), settledPaymentStatuses(), gte(payments.createdAt, sql`NOW() - (INTERVAL '1 day' * 84)`)))
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
