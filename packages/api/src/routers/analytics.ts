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

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
            eq(orders.status, "COMPLETED"),
            gte(orders.createdAt, startDate)
          )
        );

      // Group by date
      const dailySalesMap = new Map<string, number>();
      
      // Initialize daily sales map with all days in range to avoid gaps
      for (let i = input.days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0]!;
        dailySalesMap.set(dateStr, 0);
      }

      for (const order of ordersList) {
        if (!order.createdAt) continue;
        const dateStr = order.createdAt.toISOString().split("T")[0]!;
        const currentSales = dailySalesMap.get(dateStr) || 0;
        dailySalesMap.set(dateStr, currentSales + Number(order.total));
      }

      const trends = Array.from(dailySalesMap.entries()).map(([date, totalSales]) => ({
        date,
        totalSales,
      })).sort((a, b) => a.date.localeCompare(b.date));

      return trends;
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
            eq(orders.status, "COMPLETED")
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
        const menuItem = menuItemsList.find((mi) => mi.id === item.menuItemId);
        const name = menuItem?.name || `Item ${item.menuItemId}`;
        const rev = productRevenueMap.get(name) || 0;
        productRevenueMap.set(name, rev + Number(item.totalPrice));
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

      const ordersList = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.branchId, resolveBranchId(ctx, input.branchId)),
            gte(orders.createdAt, startDate)
          )
        );

      if (ordersList.length === 0) return [];
      const orderIds = ordersList.map((o) => o.id);

      const paymentsList = await ctx.restaurantDb
        .select()
        .from(payments)
        .where(inArray(payments.orderId, orderIds));

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
        methodMap.set(method, amt + Number(pay.amount));
      }

      return Array.from(methodMap.entries()).map(([method, amount]) => ({
        method,
        amount,
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
          subtotal: order.subtotal,
          tax: order.tax,
          discount: order.discount,
          bunzPaid: order.bunzPaid,
          total: order.total,
          cfdiStatus: order.cfdiStatus,
        };
      });
    }),
});
