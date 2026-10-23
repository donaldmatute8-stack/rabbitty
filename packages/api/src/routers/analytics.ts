import { z } from "zod";
import { router, protectedProcedure, resolveBranchId } from "../trpc";
import { and, eq, gte, inArray } from "drizzle-orm";
import { orders, orderItems, menuItems, payments, branches, customers } from "@rabbitty/database-restaurant/schema";

export const analyticsRouter = router({
  getSalesTrends: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        days: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Local date string helper (YYYY-MM-DD in local time)
      const toLocalDateStr = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate)
          )
        );

      // Group by date — include tax and base breakdown for fiscal reconciliation
      type DayBucket = { totalSales: number; taxTotal: number; baseTotal: number };
      const dailySalesMap = new Map<string, DayBucket>();
      
      // Initialize daily sales map with all days in range to avoid gaps
      for (let i = input.days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailySalesMap.set(toLocalDateStr(d), { totalSales: 0, taxTotal: 0, baseTotal: 0 });
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
        days: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate)
          )
        );

      const hourlySales = Array(24).fill(0).map((_, hour) => ({ hour, sales: 0, orderCount: 0 }));

      for (const order of ordersList) {
        if (!order.createdAt) continue;
        const hour = order.createdAt.getHours();
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
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
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
        .where(eq(menuItems.branchId, resolveBranchId(ctx, input.branchId)));

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
        days: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Same rule as the cash register (computeShiftTotals): COMPLETED payments
      // of the branch, bucketed by payment date, regardless of order status
      // (so partially paid orders are counted too).
      const paymentsList = await ctx.restaurantDb
        .select({ method: payments.method, amount: payments.amount })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
            eq(payments.status, "COMPLETED"),
            gte(payments.createdAt, startDate)
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
        days: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const [branch] = await ctx.restaurantDb
        .select()
        .from(branches)
        .where(eq(branches.id, resolveBranchId(ctx, input.branchId)));
      if (!branch) return [];

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
            inArray(orders.status, ["COMPLETED", "PAID"]),
            gte(orders.createdAt, startDate)
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
});
