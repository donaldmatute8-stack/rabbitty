import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { tables as tablesTable, menuCategories, menuItems, orders, orderItems, payments, menuItemModifiers, restaurants } from "@rabbitty/database-restaurant/schema";
import { users as coreUsers } from "@rabbitty/database-core/schema";
import { miniappClient } from "../services/miniapp-client";

export const posRouter = router({
  getTables: protectedProcedure.query(async ({ ctx }) => {
    const tables = await ctx.restaurantDb.select().from(tablesTable).where(eq(tablesTable.branchId, ctx.branchId));
    return tables;
  }),

  getTable: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.restaurantDb.select().from(tablesTable).where(
        and(
          eq(tablesTable.id, input.id),
          eq(tablesTable.branchId, ctx.branchId)
        )
      );
      return table;
    }),

  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const categories = await ctx.restaurantDb.select().from(menuCategories).where(
      eq(menuCategories.branchId, ctx.branchId)
    ).orderBy(asc(menuCategories.sortOrder));
    return categories;
  }),

  getMenuItems: protectedProcedure
    .input(z.object({ categoryId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where = input.categoryId
        ? and(
            eq(menuItems.categoryId, input.categoryId),
            eq(menuItems.branchId, ctx.branchId)
          )
        : eq(menuItems.branchId, ctx.branchId);
      const items = await ctx.restaurantDb.select().from(menuItems).where(where).orderBy(asc(menuItems.sortOrder));
      return items;
    }),

  getOrders: protectedProcedure
    .input(z.object({ tableId: z.string().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let where = input.tableId
        ? and(
            eq(orders.tableId, input.tableId),
            eq(orders.branchId, ctx.branchId)
          )
        : eq(orders.branchId, ctx.branchId);
      if (input.status) {
        where = and(where, eq(orders.status, input.status));
      }
      const ordersList = await ctx.restaurantDb.select().from(orders).where(where).orderBy(asc(orders.createdAt));
      const ordersWithItems = await Promise.all(ordersList.map(async (order) => {
        const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const itemsWithNames = await Promise.all(items.map(async (item) => {
          const [menuItem] = await ctx.restaurantDb.select().from(menuItems).where(eq(menuItems.id, item.menuItemId));
          return { ...item, name: menuItem?.name ?? item.menuItemId };
        }));
        return { ...order, items: itemsWithNames };
      }));
      return ordersWithItems;
    }),

  createOrder: protectedProcedure
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
      })
    )
     .mutation(async ({ ctx, input }) => {
       const [order] = await ctx.restaurantDb.insert(orders).values({
         branchId: ctx.branchId,
         tableId: input.tableId ?? null,
         orderType: input.orderType,
         customerName: input.customerName ?? null,
         customerPhone: input.customerPhone ?? null,
         subtotal: 0,
         tax: 0,
         discount: 0,
         tip: 0,
         total: 0,
       }).returning();
       if (!order) throw new Error("Error al crear la orden");
       bus.emit(EventTypes.ORDER_CREATED, { orderId: order.id, tableId: input.tableId });
       return order;
     }),

  addToCart: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        menuItemId: z.string(),
        quantity: z.number().min(1),
        modifiers: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
        const [menuItem] = await ctx.restaurantDb.select().from(menuItems).where(eq(menuItems.id, input.menuItemId));
        if (!menuItem) {
          throw new Error("Producto no encontrado");
        }
        const unitPrice = menuItem.price;
       const totalPrice = unitPrice * input.quantity;
      const existingItems = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
      const nextSortOrder = existingItems.length;
      const [orderItem] = await ctx.restaurantDb.insert(orderItems).values({
        orderId: input.orderId,
        menuItemId: input.menuItemId,
        quantity: input.quantity,
        unitPrice,
        totalPrice,
        sortOrder: nextSortOrder,
        modifiers: input.modifiers ?? null,
        notes: input.notes ?? null,
      }).returning();
      const allItems = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
      const subtotal = allItems.reduce((s, i) => s + Number(i.totalPrice), 0);
      const tax = Math.round(subtotal * 0.16 * 100) / 100;
      const total = subtotal + tax;
      await ctx.restaurantDb.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, input.orderId));
      return orderItem;
    }),

  removeFromCart: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [removed] = await ctx.restaurantDb.delete(orderItems).where(eq(orderItems.id, input.id)).returning();
      if (removed) {
        const allItems = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, removed.orderId));
        const subtotal = allItems.reduce((s, i) => s + Number(i.totalPrice), 0);
        const tax = Math.round(subtotal * 0.16 * 100) / 100;
        const total = subtotal + tax;
        await ctx.restaurantDb.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, removed.orderId));
      }
      return { success: true };
    }),

  clearCart: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(orderItems).where(eq(orderItems.orderId, input.orderId)).returning();
      return { success: true };
    }),

  payOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
        amount: z.number(),
        discountPercent: z.number().min(0).max(100).optional(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [orderRow] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!orderRow) {
        throw new Error("Orden no encontrada");
      }

      // Server-side discount calculation (trust the server, not the client)
      let finalAmount = input.amount;
      if (input.discountPercent && input.discountPercent > 0) {
        const serverCalculated = orderRow.total * (1 - input.discountPercent / 100);
        if (Math.abs(serverCalculated - input.amount) > 1) {
          throw new Error("Monto de descuento inválido");
        }
        finalAmount = serverCalculated;
        await ctx.restaurantDb.update(orders)
          .set({ discount: input.discountPercent / 100 * orderRow.total })
          .where(eq(orders.id, input.orderId));
      }

      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: input.orderId,
        method: input.method,
        amount: finalAmount,
        reference: input.reference ?? null,
      }).returning();
      
      const existingPayments = await ctx.restaurantDb.select().from(payments).where(eq(payments.orderId, input.orderId));
      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      
      if (input.method === "BUNZ") {
        await ctx.restaurantDb.update(orders)
          .set({ bunzPaid: (orderRow.bunzPaid || 0) + finalAmount })
          .where(eq(orders.id, input.orderId));
      }

      if (totalPaid >= orderRow.total) {
        await ctx.restaurantDb.update(orders).set({ status: "COMPLETED" }).where(eq(orders.id, input.orderId));

        // INVENTORY DEDUCTION LOGIC
        const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
        for (const item of items) {
          const ingredients = await ctx.restaurantDb.select()
            .from(dbSchema.menuItemIngredients)
            .where(eq(dbSchema.menuItemIngredients.menuItemId, item.menuItemId));
          
          for (const ing of ingredients) {
            const deductionAmount = ing.quantityRequired * item.quantity;
            
            // Insert movement
            await ctx.restaurantDb.insert(dbSchema.inventoryMovements).values({
              itemId: ing.inventoryItemId,
              branchId: ctx.branchId,
              type: "SALE_DEDUCTION",
              quantity: deductionAmount,
              reference: input.orderId,
              notes: `Order ${input.orderId} completed`,
            });

            // Update stock
            await ctx.restaurantDb.execute(sql`
              UPDATE inventory_items 
              SET stock = stock - ${deductionAmount} 
              WHERE id = ${ing.inventoryItemId}
            `);
          }
        }
      } else {
        await ctx.restaurantDb.update(orders).set({ status: "PARTIAL_PAID" }).where(eq(orders.id, input.orderId));
      }

      const branchesTable = dbSchema.branches;
      const [branch] = await ctx.restaurantDb.select().from(branchesTable).where(eq(branchesTable.id, ctx.branchId));
      if (!branch) throw new Error("Sucursal no encontrada");
      
      const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
      if (!restaurant) throw new Error("Restaurante no encontrado");
      
      // defaultRewardRate se almacena como porcentaje entero (20 = 20%).
      // Si por datos legacy es una fracción (< 1), se normaliza a porcentaje
      // y luego se divide entre 100 para obtener el multiplicador.
      const normalizeToPercent = (v: number | null | undefined) =>
        typeof v === "number" && v > 0 && v < 1 ? v * 100 : v;

      let rewardRate = (normalizeToPercent(restaurant.defaultRewardRate) ?? 20) / 100;

      if (restaurant.happyHourStart && restaurant.happyHourEnd) {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (timeString >= restaurant.happyHourStart && timeString <= restaurant.happyHourEnd) {
          rewardRate = (normalizeToPercent(restaurant.happyHourRewardRate) ?? (normalizeToPercent(restaurant.defaultRewardRate) ?? 20)) / 100;
        }
      }

      // Sync with miniapp & CRM
      if (orderRow.customerPhone) {
        // CRM Auto-segmentation
        const [existingCustomer] = await ctx.restaurantDb.select().from(dbSchema.customers).where(
          and(
            eq(dbSchema.customers.restaurantId, restaurant.id),
            eq(dbSchema.customers.phone, orderRow.customerPhone)
          )
        );

        let newVisits = 1;
        let newSpent = input.amount;
        
        if (existingCustomer) {
          newVisits = existingCustomer.totalVisits + 1;
          newSpent = existingCustomer.totalSpent + input.amount;
          
          let newSegment = "NEW";
          if (newVisits >= 5) newSegment = "VIP";
          else if (newVisits > 1) newSegment = "RECURRENT";

          await ctx.restaurantDb.update(dbSchema.customers).set({
            totalVisits: newVisits,
            totalSpent: newSpent,
            lastVisitAt: new Date(),
            segment: newSegment,
            name: orderRow.customerName ?? existingCustomer.name
          }).where(eq(dbSchema.customers.id, existingCustomer.id));
        } else {
          await ctx.restaurantDb.insert(dbSchema.customers).values({
            restaurantId: restaurant.id,
            phone: orderRow.customerPhone,
            name: orderRow.customerName,
            totalVisits: 1,
            totalSpent: input.amount,
            lastVisitAt: new Date(),
            segment: "NEW"
          });
        }

        const calculatedReward = Math.floor(input.amount * rewardRate);
        if (input.method === "BUNZ") {
          try {
            const result = await miniappClient.chargeBunz(orderRow.customerPhone, input.amount, input.orderId, ctx.branchId);
            await miniappClient.sendNotification({
              userId: orderRow.customerPhone,
              title: "Pago con Bunz",
              message: `Pagaste $${input.amount} con Bunz en tu restaurante. Saldo restante: ${result.balance_remaining} Bunz.`,
              type: "REWARD",
            });
          } catch {
            // Non-critical
          }
        } else {
          try {
            const result = await miniappClient.rewardBunz(orderRow.customerPhone, input.amount, input.orderId, ctx.branchId);
            if (result.userId) {
              await miniappClient.sendNotification({
                userId: result.userId,
                title: "¡Bunz ganados!",
                message: `Ganaste ${result.bunz} Bunz por tu consumo de $${input.amount}.`,
                type: "REWARD",
              });
            }
          } catch {
            // Non-critical
          }
        }
        bus.emit(EventTypes.BUNZ_REWARD, { customerId: orderRow.customerPhone, rewardPoints: calculatedReward });
      }

      bus.emit(EventTypes.ORDER_PAID, { orderId: input.orderId });
      return { success: true };
    }),

  linkCustomerToOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        customerPhone: z.string(),
        customerName: z.string().optional(),
        customerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.update(orders)
        .set({
          customerPhone: input.customerPhone,
          customerName: input.customerName ?? null,
          customerId: input.customerId ?? null,
        })
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.branchId, ctx.branchId)
          )
        )
        .returning();
      if (!order) throw new Error("Orden no encontrada");
      return order;
    }),

  voidOrder: protectedProcedure
    .input(z.object({ orderId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(orders).set({
        status: "VOIDED",
        voidReason: input.reason,
      }).where(eq(orders.id, input.orderId));
      bus.emit(EventTypes.ORDER_VOIDED, { orderId: input.orderId });
      return { success: true };
    }),

  generateQR: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [table] = await ctx.restaurantDb.select().from(tablesTable).where(eq(tablesTable.id, input.tableId));
      if (!table) {
        throw new Error("Mesa no encontrada");
      }
      const baseUrl = process.env.RABBITTY_DOMAIN || "https://rabbitty.me";
      const qrCode = `${baseUrl}/qr/table/${input.tableId}?branch=${table.branchId}`;
      await ctx.restaurantDb.update(tablesTable).set({ qrCode }).where(eq(tablesTable.id, input.tableId));
      return { qrCode };
    }),

  getTableQR: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [table] = await ctx.restaurantDb.select().from(tablesTable).where(eq(tablesTable.id, input.tableId));
      return { qrCode: table?.qrCode ?? null };
    }),

  verifyBunzBalance: protectedProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.coreDb.select().from(coreUsers).where(eq(coreUsers.id, input.customerId));
      const balance = user ? (user.totalBunzEarned - user.totalBunzSpent) : 0;
      return { customerId: input.customerId, balance };
    }),

  getModifiers: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const modifiers = await ctx.restaurantDb.select().from(menuItemModifiers).where(eq(menuItemModifiers.itemId, input.itemId));
      return modifiers;
    }),

  createModifier: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        name: z.string(),
        type: z.enum(["SELECT", "CHECKBOX"]).default("SELECT"),
        priceAdjust: z.number().default(0),
        maxSelect: z.number().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [modifier] = await ctx.restaurantDb.insert(menuItemModifiers).values(input).returning();
      return modifier;
    }),

  updateModifier: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z.enum(["SELECT", "CHECKBOX"]).optional(),
        priceAdjust: z.number().optional(),
        maxSelect: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(menuItemModifiers).set(input).where(eq(menuItemModifiers.id, input.id));
      return { success: true };
    }),
});
