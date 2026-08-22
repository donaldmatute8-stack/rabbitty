import { z } from "zod";
import { eq, and, sql, or, ilike } from "drizzle-orm";
import { router, protectedProcedure, adminOnlyProcedure } from "../trpc";
import {
  branches,
  restaurants,
  tables,
  tableSessions,
  menuCategories,
  menuItems,
  orders,
  orderItems,
  payments,
  expenses,
  staff,
} from "@rabbitty/database-restaurant/schema";
import { TRPCError } from "@trpc/server";

export const sandboxRouter = router({
  getSandboxStatus: protectedProcedure.query(async ({ ctx }) => {
    const allBranches = await ctx.restaurantDb.select().from(branches);
    const sandboxBranch = allBranches.find(
      (b) =>
        b.name.toLowerCase().includes("sandbox") ||
        b.name.toLowerCase().includes("entrenamiento")
    );

    if (!sandboxBranch) {
      return {
        hasSandbox: false,
        sandboxBranch: null,
        stats: null,
      };
    }

    const [ordersList, tablesList, itemsList, expensesList] = await Promise.all([
      ctx.restaurantDb.select().from(orders).where(eq(orders.branchId, sandboxBranch.id)),
      ctx.restaurantDb.select().from(tables).where(eq(tables.branchId, sandboxBranch.id)),
      ctx.restaurantDb.select().from(menuItems).where(eq(menuItems.branchId, sandboxBranch.id)),
      ctx.restaurantDb.select().from(expenses).where(eq(expenses.branchId, sandboxBranch.id)),
    ]);

    return {
      hasSandbox: true,
      sandboxBranch: {
        id: sandboxBranch.id,
        name: sandboxBranch.name,
        address: sandboxBranch.address,
      },
      stats: {
        totalOrders: ordersList.length,
        totalTables: tablesList.length,
        totalMenuItems: itemsList.length,
        totalExpenses: expensesList.length,
      },
    };
  }),

  initSandbox: adminOnlyProcedure.mutation(async ({ ctx }) => {
    const allBranches = await ctx.restaurantDb.select().from(branches);
    let sandboxBranch = allBranches.find(
      (b) =>
        b.name.toLowerCase().includes("sandbox") ||
        b.name.toLowerCase().includes("entrenamiento")
    );

    const mainBranch = allBranches.find(
      (b) =>
        !b.name.toLowerCase().includes("sandbox") &&
        !b.name.toLowerCase().includes("entrenamiento")
    ) || allBranches[0];

    if (!mainBranch) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No se encontró ninguna sucursal principal activa para clonar.",
      });
    }

    // If sandbox doesn't exist, create it
    if (!sandboxBranch) {
      const [newBranch] = await ctx.restaurantDb
        .insert(branches)
        .values({
          restaurantId: mainBranch.restaurantId,
          name: "🧪 Modo Entrenamiento (Sandbox)",
          address: "Entorno Simulado de Capacitación",
          phone: mainBranch.phone,
          isActive: true,
        })
        .returning();

      sandboxBranch = newBranch;
    }

    if (!sandboxBranch) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear sucursal sandbox" });
    }

    // Clone categories, menu items, and tables if sandbox has none
    const existingCategories = await ctx.restaurantDb
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.branchId, sandboxBranch.id));

    if (existingCategories.length === 0) {
      // Fetch main branch categories and items
      const mainCategories = await ctx.restaurantDb
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.branchId, mainBranch.id));

      const mainItems = await ctx.restaurantDb
        .select()
        .from(menuItems)
        .where(eq(menuItems.branchId, mainBranch.id));

      const categoryMap = new Map<string, string>();

      for (const cat of mainCategories) {
        const [clonedCat] = await ctx.restaurantDb
          .insert(menuCategories)
          .values({
            branchId: sandboxBranch.id,
            name: cat.name,
            description: cat.description,
            sortOrder: cat.sortOrder,
            printerZone: cat.printerZone,
            isActive: true,
          })
          .returning();
        if (clonedCat) {
          categoryMap.set(cat.id, clonedCat.id);
        }
      }

      for (const item of mainItems) {
        const targetCatId = categoryMap.get(item.categoryId);
        if (targetCatId) {
          await ctx.restaurantDb.insert(menuItems).values({
            categoryId: targetCatId,
            branchId: sandboxBranch.id,
            name: item.name,
            description: item.description,
            price: item.price,
            cost: item.cost,
            imageUrl: item.imageUrl,
            sku: item.sku,
            isActive: true,
            isAvailable: true,
            sortOrder: item.sortOrder,
          });
        }
      }
    }

    // Clone tables if sandbox has none
    const existingTables = await ctx.restaurantDb
      .select()
      .from(tables)
      .where(eq(tables.branchId, sandboxBranch.id));

    if (existingTables.length === 0) {
      const mainTables = await ctx.restaurantDb
        .select()
        .from(tables)
        .where(eq(tables.branchId, mainBranch.id));

      if (mainTables.length > 0) {
        for (const t of mainTables) {
          await ctx.restaurantDb.insert(tables).values({
            branchId: sandboxBranch.id,
            number: t.number,
            capacity: t.capacity,
            location: t.location,
            isActive: true,
          });
        }
      } else {
        // Create 6 default tables for practice
        for (let i = 1; i <= 6; i++) {
          await ctx.restaurantDb.insert(tables).values({
            branchId: sandboxBranch.id,
            number: i,
            capacity: 4,
            location: i <= 4 ? "Salón Principal" : "Terraza",
            isActive: true,
          });
        }
      }
    }

    return {
      success: true,
      branchId: sandboxBranch.id,
      name: sandboxBranch.name,
    };
  }),

  resetSandbox: adminOnlyProcedure.mutation(async ({ ctx }) => {
    const allBranches = await ctx.restaurantDb.select().from(branches);
    const sandboxBranch = allBranches.find(
      (b) =>
        b.name.toLowerCase().includes("sandbox") ||
        b.name.toLowerCase().includes("entrenamiento")
    );

    if (!sandboxBranch) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró sucursal sandbox para reiniciar." });
    }

    const sandboxOrders = await ctx.restaurantDb
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.branchId, sandboxBranch.id));

    const orderIds = sandboxOrders.map((o) => o.id);

    if (orderIds.length > 0) {
      for (const oId of orderIds) {
        await ctx.restaurantDb.delete(payments).where(eq(payments.orderId, oId));
        await ctx.restaurantDb.delete(orderItems).where(eq(orderItems.orderId, oId));
      }
      await ctx.restaurantDb.delete(orders).where(eq(orders.branchId, sandboxBranch.id));
    }

    await ctx.restaurantDb.delete(tableSessions).where(eq(tableSessions.branchId, sandboxBranch.id));
    await ctx.restaurantDb.delete(expenses).where(eq(expenses.branchId, sandboxBranch.id));

    return { success: true };
  }),

  seedDemoData: adminOnlyProcedure.mutation(async ({ ctx }) => {
    const allBranches = await ctx.restaurantDb.select().from(branches);
    const sandboxBranch = allBranches.find(
      (b) =>
        b.name.toLowerCase().includes("sandbox") ||
        b.name.toLowerCase().includes("entrenamiento")
    );

    if (!sandboxBranch) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Primero debes inicializar el entorno Sandbox." });
    }

    // 1. Reset current sandbox data
    const sandboxOrders = await ctx.restaurantDb
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.branchId, sandboxBranch.id));

    for (const o of sandboxOrders) {
      await ctx.restaurantDb.delete(payments).where(eq(payments.orderId, o.id));
      await ctx.restaurantDb.delete(orderItems).where(eq(orderItems.orderId, o.id));
    }
    await ctx.restaurantDb.delete(orders).where(eq(orders.branchId, sandboxBranch.id));
    await ctx.restaurantDb.delete(tableSessions).where(eq(tableSessions.branchId, sandboxBranch.id));
    await ctx.restaurantDb.delete(expenses).where(eq(expenses.branchId, sandboxBranch.id));

    // 2. Fetch sandbox tables & menu items
    const sandboxTables = await ctx.restaurantDb
      .select()
      .from(tables)
      .where(eq(tables.branchId, sandboxBranch.id));

    const sandboxItems = await ctx.restaurantDb
      .select()
      .from(menuItems)
      .where(eq(menuItems.branchId, sandboxBranch.id));

    const t1 = sandboxTables[0];
    const t2 = sandboxTables[1] || sandboxTables[0];
    const item1 = sandboxItems[0] || { id: "item-1", price: 120, name: "Hamburguesa Clásica" };
    const item2 = sandboxItems[1] || { id: "item-2", price: 45, name: "Refresco 355ml" };
    const item3 = sandboxItems[2] || { id: "item-3", price: 180, name: "Pizza Artesanal" };

    // 3. Create demo table session 1 (Mesa 1 - Cuenta lista para cobrar)
    if (t1) {
      const [session1] = await ctx.restaurantDb
        .insert(tableSessions)
        .values({
          tableId: t1.id,
          branchId: sandboxBranch.id,
          customerCount: 2,
          status: "OPEN",
        })
        .returning();

      if (session1) {
        const total1 = item1.price * 2 + item2.price * 2;
        const [order1] = await ctx.restaurantDb
          .insert(orders)
          .values({
            branchId: sandboxBranch.id,
            tableId: t1.id,
            tableSessionId: session1.id,
            customerName: "Juan Pérez (Cliente Demo)",
            orderType: "DINE_IN",
            status: "IN_PROGRESS",
            subtotal: total1 / 1.16,
            tax: total1 - total1 / 1.16,
            total: total1,
            notes: "Sin hielo en las bebidas",
          })
          .returning();

        if (order1 && item1.id && item2.id) {
          await ctx.restaurantDb.insert(orderItems).values([
            {
              orderId: order1.id,
              menuItemId: item1.id,
              quantity: 2,
              unitPrice: item1.price,
              totalPrice: item1.price * 2,
              status: "SERVED",
            },
            {
              orderId: order1.id,
              menuItemId: item2.id,
              quantity: 2,
              unitPrice: item2.price,
              totalPrice: item2.price * 2,
              status: "SERVED",
            },
          ]);
        }
      }
    }

    // 4. Create demo table session 2 (Mesa 2 - Comanda en preparación para KDS)
    if (t2 && t2.id !== t1?.id) {
      const [session2] = await ctx.restaurantDb
        .insert(tableSessions)
        .values({
          tableId: t2.id,
          branchId: sandboxBranch.id,
          customerCount: 4,
          status: "OPEN",
        })
        .returning();

      if (session2) {
        const total2 = item3.price * 2 + item1.price;
        const [order2] = await ctx.restaurantDb
          .insert(orders)
          .values({
            branchId: sandboxBranch.id,
            tableId: t2.id,
            tableSessionId: session2.id,
            customerName: "Familia García (Prueba KDS)",
            orderType: "DINE_IN",
            status: "PREPARING",
            subtotal: total2 / 1.16,
            tax: total2 - total2 / 1.16,
            total: total2,
            notes: "Mesa VIP - Preparar rápido",
          })
          .returning();

        if (order2 && item3.id && item1.id) {
          await ctx.restaurantDb.insert(orderItems).values([
            {
              orderId: order2.id,
              menuItemId: item3.id,
              quantity: 2,
              unitPrice: item3.price,
              totalPrice: item3.price * 2,
              status: "PREPARING",
            },
            {
              orderId: order2.id,
              menuItemId: item1.id,
              quantity: 1,
              unitPrice: item1.price,
              totalPrice: item1.price,
              status: "PENDING",
            },
          ]);
        }
      }
    }

    // 5. Create sample test expense
    await ctx.restaurantDb.insert(expenses).values({
      branchId: sandboxBranch.id,
      category: "SUPPLIES",
      description: "Compra de servilletas y vasos para práctica",
      amount: 175.50,
      paidTo: "Distribuidora de Desechables",
      reference: "TICKET-DEMO-001",
      notes: "Gasto de prueba en entorno Sandbox",
    });

    return { success: true };
  }),
});
