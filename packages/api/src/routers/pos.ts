import { z } from "zod";
import { and, asc, desc, eq, sql, inArray, or, ilike } from "drizzle-orm";
import crypto from "crypto";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { tables as tablesTable, tableSessions, branches, menuCategories, menuItems, orders, orderItems, payments, menuItemModifiers, restaurants } from "@rabbitty/database-restaurant/schema";
import { users as coreUsers } from "@rabbitty/database-core/schema";
import { miniappClient } from "../services/miniapp-client";
import { assertOpenShiftForCash } from "../services/cashShift";

/**
 * Genera un claimToken criptográfico para el ticket de compra.
 * Formato: orderId.exp.hmac (de un solo uso, expira en 48 horas).
 */
export function generateTicketClaimToken(orderId: string, amount: number, branchId: string): string {
  const secret = process.env.RABBITTY_API_SECRET;
  if (!secret) {
    throw new Error("[SECURITY_CRITICAL] RABBITTY_API_SECRET environment variable is missing. Refusing to generate insecure ticket claim token.");
  }
  const exp = Math.floor(Date.now() / 1000) + 48 * 3600; // 48 horas
  const payload = `${orderId}:${amount}:${branchId}:${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return `${orderId}.${exp}.${sig}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FISCAL CANÓNICO (México IVA 16% incluido en precio)
//
// Regla: los precios del menú ya incluyen IVA (precio de venta al público).
//   total    = suma exacta de los items (sin redondeo adicional)
//   subtotal = Math.round((total / 1.16) * 100) / 100   → base gravable
//   tax      = total - subtotal                          → IVA exacto (NO redondear)
//
// Nunca redondear `tax` por separado. Así subtotal + tax === total siempre,
// sin centavos perdidos o inventados.
// ─────────────────────────────────────────────────────────────────────────────
const TAX_RATE = 0.16;
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Calcula base (subtotal), IVA y total a partir de los items de una orden.
 *  Garantía: subtotal + tax === total (sin discrepancias de redondeo). */
export function calcTax(itemsTotal: number): { total: number; subtotal: number; tax: number } {
  const total = r2(itemsTotal);
  const subtotal = r2(total / (1 + TAX_RATE));
  const tax = r2(total - subtotal); // derived, never independently rounded from scratch
  return { total, subtotal, tax };
}


export const posRouter = router({
  /**
   * Búsqueda e identificación inmediata de Rabbitter antes de cobrar:
   * Por QR personal (UUID / telegramId / username) o por teléfono.
   */
  lookupRabbitter: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

      const conditions = [
        eq(coreUsers.telegramId, q),
        eq(coreUsers.phoneNumber, q),
        eq(coreUsers.username, q),
      ];
      if (isUuid) {
        conditions.push(eq(coreUsers.id, q));
      }

      const [user] = await ctx.coreDb
        .select({
          id: coreUsers.id,
          firstName: coreUsers.firstName,
          lastName: coreUsers.lastName,
          username: coreUsers.username,
          phoneNumber: coreUsers.phoneNumber,
          telegramId: coreUsers.telegramId,
          totalBunzEarned: coreUsers.totalBunzEarned,
          hops: coreUsers.hops,
          levelId: coreUsers.levelId,
        })
        .from(coreUsers)
        .where(or(...conditions))
        .limit(1);

      if (!user) {
        return null;
      }

      // Obtener porcentaje de cashback vigente de la sucursal actual
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: dbSchema.branches.restaurantId })
        .from(dbSchema.branches)
        .where(eq(dbSchema.branches.id, ctx.branchId))
        .limit(1);

      let rewardRate = 20;
      if (branch) {
        const [restaurant] = await ctx.restaurantDb
          .select({ defaultRewardRate: restaurants.defaultRewardRate })
          .from(restaurants)
          .where(eq(restaurants.id, branch.restaurantId))
          .limit(1);
        if (restaurant?.defaultRewardRate) {
          rewardRate = restaurant.defaultRewardRate;
        }
      }

      return {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Rabbitter",
        phoneNumber: user.phoneNumber,
        telegramId: user.telegramId,
        bunzBalance: user.totalBunzEarned,
        hops: user.hops,
        level: user.levelId || "Rookie",
        currentRewardRate: rewardRate,
      };
    }),

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
      const { total, subtotal, tax } = calcTax(allItems.reduce((s, i) => s + Number(i.totalPrice), 0));
      await ctx.restaurantDb.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, input.orderId));
      return orderItem;
    }),

  removeFromCart: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.id, input.id));
      if (!item) throw new Error("Item no encontrado");
      if (item.status !== "PENDING") {
        throw new Error("No puedes eliminar un artículo que ya está en cocina. Usa la función de Cancelación (Void).");
      }

      const [removed] = await ctx.restaurantDb.delete(orderItems).where(eq(orderItems.id, input.id)).returning();
      if (removed) {
        const allItems = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, removed.orderId));
        const { total, subtotal, tax } = calcTax(allItems.reduce((s, i) => s + Number(i.totalPrice), 0));
        await ctx.restaurantDb.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, removed.orderId));
        return removed;
      }
      return null;
    }),

  clearCart: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only delete PENDING items
      await ctx.restaurantDb.delete(orderItems).where(and(
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.status, "PENDING")
      )).returning();
      
      const allItems = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
      const { total, subtotal, tax } = calcTax(allItems.reduce((s, i) => s + Number(i.totalPrice), 0));
      await ctx.restaurantDb.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, input.orderId));
      
      return { success: true };
    }),

  voidItem: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string(),
      managerPin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Import dynamically to avoid circular dependencies if any
      const { staff } = await import("@rabbitty/database-restaurant/schema");
      const { verifyPin } = await import("../services/crypto");

      // Verify manager PIN
      const managers = await ctx.restaurantDb.select().from(staff).where(
        and(
          eq(staff.branchId, ctx.branchId),
          inArray(staff.role, ["MANAGER", "ADMIN"])
        )
      );

      let authorizedStaffId = null;
      for (const s of managers) {
        if (s.pinCode && verifyPin(input.managerPin, s.pinCode)) {
          authorizedStaffId = s.id;
          break;
        }
      }

      if (!authorizedStaffId) {
        throw new Error("PIN de Manager inválido");
      }

      const [item] = await ctx.restaurantDb.update(orderItems).set({
        status: "CANCELLED",
        voidReason: input.reason,
        authorizedById: authorizedStaffId,
        voidedAt: new Date(),
        totalPrice: 0, // Voided items cost 0
      }).where(eq(orderItems.id, input.id)).returning();

      if (item) {
        const allItems = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, item.orderId));
        const { total, subtotal, tax } = calcTax(allItems.reduce((s, i) => s + Number(i.totalPrice), 0));
        await ctx.restaurantDb.update(orders).set({ subtotal, tax, total }).where(eq(orders.id, item.orderId));
      }

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
      if (input.method === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }
      const [orderRow] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!orderRow) {
        throw new Error("Orden no encontrada");
      }

      // Server-side discount calculation (trust the server, not the client)
      // orders.total is always the amount actually owed (net of discount).
      // Gross is recovered as total + stored discount to avoid double discounting.
      let finalAmount = r2(input.amount);
      let calculatedDiscount = orderRow.discount || 0;
      let orderNetTotal = orderRow.total;
      if (input.discountPercent && input.discountPercent > 0) {
        const gross = r2(orderRow.total + (orderRow.discount || 0));
        const net = r2(gross * (1 - input.discountPercent / 100));
        if (Math.abs(net - input.amount) > 1) {
          throw new Error("Monto de descuento inválido");
        }
        finalAmount = net;
        calculatedDiscount = r2(gross - net);
        orderNetTotal = net;
        const t = calcTax(net);
        await ctx.restaurantDb.update(orders)
          .set({ discount: calculatedDiscount, total: t.total, subtotal: t.subtotal, tax: t.tax })
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

      const targetPayableAmount = Math.max(0, orderNetTotal);
      if (r2(totalPaid) >= targetPayableAmount) {
        await ctx.restaurantDb.update(orders).set({ status: "COMPLETED" }).where(eq(orders.id, input.orderId));

        // Liberar la mesa también en el pago de órdenes existentes (kiosko/self-tab):
        // cierra la sesión activa de la tabla para el próximo comensal.
        const paidOrderRow = await ctx.restaurantDb.select({ tableId: orders.tableId }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (paidOrderRow[0]?.tableId) {
          await ctx.restaurantDb.update(tableSessions).set({
            status: "CLOSED",
            closedAt: new Date(),
          }).where(and(
            eq(tableSessions.tableId, paidOrderRow[0].tableId),
            eq(tableSessions.status, "OPEN")
          ));
        }

        // INVENTORY DEDUCTION LOGIC (recursive for sub-recipes)
        const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));

        const deductRecipe = async (menuItemId: string, qty: number, path: Set<string>) => {
          if (path.has(menuItemId)) return;
          path.add(menuItemId);
          const ingredients = await ctx.restaurantDb.select()
            .from(dbSchema.menuItemIngredients)
            .where(eq(dbSchema.menuItemIngredients.menuItemId, menuItemId));

          for (const ing of ingredients) {
            if (ing.inventoryItemId) {
              const deductionAmount = ing.quantityRequired * qty;

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
            } else if (ing.subRecipeId) {
              await deductRecipe(ing.subRecipeId, ing.quantityRequired * qty, path);
            }
          }
          path.delete(menuItemId);
        };

        for (const item of items) {
          await deductRecipe(item.menuItemId, item.quantity, new Set());
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
        const rewardPhone = String(orderRow.customerPhone); // narrowing estable dentro del closure
        let rewardQueued = true; // el servicio de lealtad entregó (o ya había entregado) la recompensa

        const callWithRetry = async (fnName: "chargeBunz" | "rewardBunz") => {
          // Idempotente por diseño (ledger key pos_rwd_${orderId}): un reintento jamás doble-otorga.
          const attempt = async () =>
            fnName === "chargeBunz"
              ? miniappClient.chargeBunz(rewardPhone, input.amount, input.orderId, ctx.branchId)
              : miniappClient.rewardBunz(rewardPhone, input.amount, input.orderId, ctx.branchId);

          try {
            return { ok: true as const, result: await attempt() };
          } catch (firstErr) {
            console.error("[POSCHECKOUT_REWARD_FAIL] orderId=" + input.orderId + " intento 1:", firstErr);
            try {
              await new Promise((r) => setTimeout(r, 800));
              return { ok: true as const, result: await attempt() };
            } catch (secondErr) {
              console.error("[POSCHECKOUT_REWARD_FAIL] orderId=" + input.orderId + " intento 2 definitivo:", secondErr);
              return { ok: false as const, result: null };
            }
          }
        };

        if (input.method === "BUNZ") {
          const outcome = await callWithRetry("chargeBunz");
          rewardQueued = outcome.ok;
          if (outcome.ok && outcome.result) {
            const result = outcome.result as { balance_remaining: number };
            try {
              await miniappClient.sendNotification({
                userId: rewardPhone,
                title: "Pago con Bunz",
                message: `Pagaste $${input.amount} con Bunz en tu restaurante. Saldo restante: ${result.balance_remaining} Bunz.`,
                type: "REWARD",
              });
            } catch {}
          }
        } else {
          const outcome = await callWithRetry("rewardBunz");
          rewardQueued = outcome.ok;
          if (outcome.ok && outcome.result) {
            const result = outcome.result as { userId?: string; bunz: number };
            if (result.userId) {
              try {
                await miniappClient.sendNotification({
                  userId: result.userId,
                  title: "¡Bunz ganados!",
                  message: `Ganaste ${result.bunz} Bunz por tu consumo de $${input.amount}.`,
                  type: "REWARD",
                });
              } catch {}
            }
          }
        }
        bus.emit(EventTypes.BUNZ_REWARD, { customerId: orderRow.customerPhone, rewardPoints: calculatedReward });
        return { success: true, rewardQueued };
      }

      bus.emit(EventTypes.ORDER_PAID, { orderId: input.orderId });
      return { success: true, rewardQueued: true };
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

  /**
   * Fase 2 Complementaria: Self-Tab en Mesa por QR
   * Asocia al comensal (Rabbitter) con la mesa escaneada.
   * Si ya hay una orden PENDING en esa mesa, le asigna el customerId y sus datos.
   * Si no, abre o actualiza una tableSessions activa.
   */
  claimTableSession: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        branchId: z.string().optional(),
        customerId: z.string(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isCallerStaff = Boolean(ctx.staffRole);
      const effectiveCustomerId = isCallerStaff ? input.customerId : ctx.userId;

      // 1. Validar que la mesa exista
      const [table] = await ctx.restaurantDb
        .select()
        .from(tablesTable)
        .where(eq(tablesTable.id, input.tableId))
        .limit(1);

      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mesa no encontrada" });
      }

      // 1b. Tenancy: si el caller declara una branch, debe coincidir con la de la mesa
      const requestedBranchId = input.branchId || ctx.branchId;
      if (requestedBranchId && table.branchId && requestedBranchId !== table.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La mesa no pertenece a esta sucursal." });
      }

      // 1c. Carrera de reclamo: si la sesión u orden abierta ya pertenece a OTRO
      // Rabbitter, solo el staff puede reasignarla.
      const [existingClaimSession] = await ctx.restaurantDb
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, input.tableId), eq(tableSessions.status, "OPEN")))
        .limit(1);
      const [existingClaimOrder] = await ctx.restaurantDb
        .select({ customerId: orders.customerId })
        .from(orders)
        .where(and(eq(orders.tableId, input.tableId), eq(orders.status, "PENDING")))
        .orderBy(desc(orders.createdAt))
        .limit(1);
      const alreadyClaimedBy = existingClaimSession?.customerId || existingClaimOrder?.customerId || null;
      if (alreadyClaimedBy && alreadyClaimedBy !== effectiveCustomerId && !isCallerStaff) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta mesa ya está vinculada a otro Rabbitter. Pide a tu mesero/ayudante que revise tu cuenta.",
        });
      }

      // 2. Buscar datos del cliente si no vinieron explícitos
      let customerName = input.customerName;
      let customerPhone = input.customerPhone;
      let customerUsername: string | null = null;

      const [coreUser] = await ctx.coreDb
        .select()
        .from(coreUsers)
        .where(eq(coreUsers.id, effectiveCustomerId))
        .limit(1);

      if (coreUser) {
        customerName = customerName || [coreUser.firstName, coreUser.lastName].filter(Boolean).join(" ") || coreUser.username || "Rabbitter";
        customerPhone = customerPhone || coreUser.phoneNumber || undefined;
        customerUsername = coreUser.username || null;
      }

      // 3. Revisar si hay una comanda PENDING abierta en esta mesa
      const [pendingOrder] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(and(eq(orders.tableId, input.tableId), eq(orders.status, "PENDING")))
        .orderBy(desc(orders.createdAt))
        .limit(1);

      if (pendingOrder) {
        await ctx.restaurantDb
          .update(orders)
          .set({
            customerId: effectiveCustomerId,
            customerName: customerName || pendingOrder.customerName,
            customerPhone: customerPhone || pendingOrder.customerPhone,
          })
          .where(eq(orders.id, pendingOrder.id));
      }

      // 4. Asegurar una table_session en estado OPEN para esta mesa
      const [existingSession] = await ctx.restaurantDb
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, input.tableId), eq(tableSessions.status, "OPEN")))
        .limit(1);

      if (existingSession) {
        await ctx.restaurantDb
          .update(tableSessions)
          .set({
            customerId: effectiveCustomerId,
          })
          .where(eq(tableSessions.id, existingSession.id));
      } else {
        await ctx.restaurantDb.insert(tableSessions).values({
          tableId: input.tableId,
          branchId: table.branchId,
          customerId: effectiveCustomerId,
          status: "OPEN",
          customerCount: 1,
        });
      }

      return {
        success: true,
        tableId: table.id,
        tableNumber: table.number,
        tableLocation: table.location,
        branchId: table.branchId,
        orderId: pendingOrder?.id ?? null,
        orderTotal: pendingOrder ? Number(pendingOrder.total || 0) : 0,
        customer: {
          id: effectiveCustomerId,
          name: customerName || "Rabbitter",
          phone: customerPhone || null,
          username: customerUsername,
        },
      };
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

  directCheckout: protectedProcedure
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        customerId: z.string().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        items: z.array(
          z.object({
            menuItemId: z.string(),
            quantity: z.number().min(1),
            price: z.number(),
            notes: z.string().optional(),
          })
        ),
        paymentMethod: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
        discountPercent: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.paymentMethod === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }
      if (input.paymentMethod === "BUNZ") {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Los pagos con BUNZ requieren verificación del sistema. Usa createPaymentIntent." 
        });
      }

      // 1. Create order
      const [order] = await ctx.restaurantDb.insert(orders).values({
        branchId: ctx.branchId,
        tableId: input.tableId ?? null,
        orderType: input.orderType,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        subtotal: 0,
        tax: 0,
        discount: 0,
        tip: 0,
        total: 0,
        status: "PENDING",
      }).returning();

      if (!order) throw new Error("No se pudo crear la orden en base de datos");

      // 2. Insert items and sum subtotal
      let calculatedSubtotal = 0;
      for (const [i, item] of input.items.entries()) {
        const totalPrice = item.price * item.quantity;
        calculatedSubtotal += totalPrice;

        await ctx.restaurantDb.insert(orderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice,
          sortOrder: i,
          notes: item.notes ?? null,
        });
      }

      // Precios de menú en México tienen el IVA incluido (precios redondos)
      let originalTotal = r2(calculatedSubtotal);
      let calculatedDiscount = 0;
      let finalAmount = originalTotal;

      if (input.discountPercent && input.discountPercent > 0) {
        calculatedDiscount = r2((input.discountPercent / 100) * originalTotal);
        finalAmount = r2(Math.max(0, originalTotal - calculatedDiscount));
      }

      // Desglose fiscal canónico: subtotal + tax = total (sin discrepancias)
      const { total: calcTotal, subtotal: calcSubtotal, tax: calcTaxAmt } = calcTax(finalAmount);

      await ctx.restaurantDb.update(orders).set({
        subtotal: calcSubtotal,
        tax: calcTaxAmt,
        discount: calculatedDiscount,
        total: calcTotal,
      }).where(eq(orders.id, order.id));

      // 3. Delegate to payOrder logic (insert payment, deduct inventory, trigger Bunz and CRM)
      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: order.id,
        method: input.paymentMethod,
        amount: finalAmount,
        verificationMethod: "CASHIER_CONFIRMED",
      }).returning();


      await ctx.restaurantDb.update(orders).set({ status: "COMPLETED" }).where(eq(orders.id, order.id));
      if (order.tableId) {
        await ctx.restaurantDb.update(tableSessions).set({
          status: "CLOSED",
          closedAt: new Date(),
        }).where(and(
          eq(tableSessions.tableId, order.tableId),
          eq(tableSessions.status, "OPEN")
        ));
      }

      // Liberar la mesa: cerrar la sesión activa de la tabla para que el
      // próximo comensal pueda reclamarla (409 anti-robo no se convierte en DoS).
      if (order.tableId) {
        await ctx.restaurantDb.update(tableSessions).set({
          status: "CLOSED",
          closedAt: new Date(),
        }).where(and(
          eq(tableSessions.tableId, order.tableId),
          eq(tableSessions.status, "OPEN")
        ));
      }

      // Deduct inventory
      const deductRecipe = async (menuItemId: string, qty: number, path: Set<string>) => {
        if (path.has(menuItemId)) return;
        path.add(menuItemId);
        const ingredients = await ctx.restaurantDb.select()
          .from(dbSchema.menuItemIngredients)
          .where(eq(dbSchema.menuItemIngredients.menuItemId, menuItemId));

        for (const ing of ingredients) {
          if (ing.inventoryItemId) {
            const deductionAmount = ing.quantityRequired * qty;
            await ctx.restaurantDb.insert(dbSchema.inventoryMovements).values({
              itemId: ing.inventoryItemId,
              branchId: ctx.branchId,
              type: "SALE_DEDUCTION",
              quantity: deductionAmount,
              reference: order.id,
              notes: `Order ${order.id} completed via Direct POS`,
            });
            await ctx.restaurantDb.execute(sql`
              UPDATE inventory_items 
              SET stock = stock - ${deductionAmount} 
              WHERE id = ${ing.inventoryItemId}
            `);
          } else if (ing.subRecipeId) {
            await deductRecipe(ing.subRecipeId, ing.quantityRequired * qty, path);
          }
        }
        path.delete(menuItemId);
      };

      for (const item of input.items) {
        await deductRecipe(item.menuItemId, item.quantity, new Set());
      }

      // CRM Auto-segmentation & Bunz Minting
      let totalAwardedBunz = 0;
      const [branch] = await ctx.restaurantDb.select().from(dbSchema.branches).where(eq(dbSchema.branches.id, ctx.branchId));
      if (branch) {
        const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
        if (restaurant && input.customerPhone) {
          const [existingCustomer] = await ctx.restaurantDb.select().from(dbSchema.customers).where(
            and(
              eq(dbSchema.customers.restaurantId, restaurant.id),
              eq(dbSchema.customers.phone, input.customerPhone)
            )
          );

          let newVisits = 1;
          let newSpent = finalAmount;
          if (existingCustomer) {
            newVisits = existingCustomer.totalVisits + 1;
            newSpent = existingCustomer.totalSpent + finalAmount;
            let newSegment = newVisits >= 5 ? "VIP" : newVisits > 1 ? "RECURRENT" : "NEW";
            await ctx.restaurantDb.update(dbSchema.customers).set({
              totalVisits: newVisits,
              totalSpent: newSpent,
              lastVisitAt: new Date(),
              segment: newSegment,
            }).where(eq(dbSchema.customers.id, existingCustomer.id));
          } else {
            await ctx.restaurantDb.insert(dbSchema.customers).values({
              restaurantId: restaurant.id,
              phone: input.customerPhone,
              name: input.customerName,
              totalVisits: 1,
              totalSpent: finalAmount,
              lastVisitAt: new Date(),
              segment: "NEW",
            });
          }

          // Mint Bunz si hay cliente identificado (por ID o por teléfono)
          const targetRecipient = input.customerPhone || input.customerId;

          if (targetRecipient) {
            // Self-heal con 1 reintento: la llamada es idempotente por ledger key
            // pos_rwd_${orderId}; un reintento jamás doble-otorga. Si ambos
            // intentos fallan, awardedBunz queda en 0 y el ticket imprime el
            // QR de claim para que el cliente recupere sus Bunz por su boleto.
            const attemptReward = async (): Promise<{ success: boolean; bunz?: number } | null> => {
              try {
                return await miniappClient.rewardBunz(targetRecipient, finalAmount, order.id, ctx.branchId);
              } catch (firstErr) {
                console.error("[POS_REWARD_FAIL] orderId=" + order.id + " intento 1:", firstErr);
                try {
                  await new Promise((r) => setTimeout(r, 800));
                  return await miniappClient.rewardBunz(targetRecipient, finalAmount, order.id, ctx.branchId);
                } catch (secondErr) {
                  console.error("[POS_REWARD_FAIL] orderId=" + order.id + " intento 2 definitivo:", secondErr);
                  return null;
                }
              }
            };

            const res = await attemptReward();
            if (res?.success) {
              totalAwardedBunz = res.bunz || Math.floor(finalAmount * ((restaurant.defaultRewardRate ?? 20) / 100));
              // Guardar Bunz otorgados en la orden para auditoría
              await ctx.restaurantDb.update(orders).set({ bunzReward: totalAwardedBunz }).where(eq(orders.id, order.id));
            }
          }
        }
      }

      bus.emit(EventTypes.ORDER_CREATED, { orderId: order.id, tableId: input.tableId });
      bus.emit(EventTypes.ORDER_PAID, { orderId: order.id });

      const claimToken = generateTicketClaimToken(order.id, calcTotal, ctx.branchId);

      return {
        success: true,
        orderId: order.id,
        orderNumber: order.id.slice(-4).toUpperCase(),
        total: calcTotal,
        subtotal: calcSubtotal,
        tax: calcTaxAmt,
        customerName: input.customerName || null,
        awardedBunz: totalAwardedBunz || (order as any)?.bunzReward || 0,
        rewardQueued: (totalAwardedBunz > 0) || Boolean((order as any)?.bunzReward && (order as any).bunzReward > 0),
        claimToken,
      };
    }),

  createPaymentIntent: protectedProcedure
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        items: z.array(
          z.object({
            menuItemId: z.string(),
            quantity: z.number().min(1),
            price: z.number(),
            notes: z.string().optional(),
          })
        ),
        discountPercent: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Create order
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
        status: "PENDING_PAYMENT",
      }).returning();

      if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear la orden" });

      // 2. Insert items and sum subtotal
      let calculatedSubtotal = 0;
      for (const [i, item] of input.items.entries()) {
        const totalPrice = item.price * item.quantity;
        calculatedSubtotal += totalPrice;

        await ctx.restaurantDb.insert(orderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice,
          sortOrder: i,
          notes: item.notes ?? null,
        });
      }

      // Precios con IVA incluido: el total es la suma exacta (sin centavos de IVA añadido)
      const originalTotal = r2(calculatedSubtotal);
      let finalAmount = originalTotal;
      let calculatedDiscount = 0;

      if (input.discountPercent && input.discountPercent > 0) {
        calculatedDiscount = r2((input.discountPercent / 100) * originalTotal);
        finalAmount = r2(Math.max(0, originalTotal - calculatedDiscount));
      }

      const { total: intentTotal, subtotal: intentBase, tax: intentTax } = calcTax(finalAmount);

      await ctx.restaurantDb.update(orders).set({
        subtotal: intentBase,
        tax: intentTax,
        discount: calculatedDiscount,
        total: intentTotal,
      }).where(eq(orders.id, order.id));

      // 3. Create Payment Intent
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes TTL

      // 1 Bunz = 1 MXN (V1 Fixed Redemption Rate)
      const BUNZ_REDEMPTION_RATE_MXN = 1.00;
      const bunzAmount = finalAmount / BUNZ_REDEMPTION_RATE_MXN;

      const [intent] = await ctx.restaurantDb.insert(dbSchema.paymentIntents).values({
        orderId: order.id,
        merchantId: ctx.branchId,
        amountMxn: finalAmount,
        bunzAmount: bunzAmount,
        status: "PENDING_PAYMENT",
        expiresAt,
      }).returning();

      if (!intent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear payment intent" });

      return {
        success: true,
        paymentIntentId: intent.id,
        orderId: order.id,
        expiresAt: intent.expiresAt,
        bunzAmount: intent.bunzAmount,
      };
    }),

  pollPaymentIntent: protectedProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [intent] = await ctx.restaurantDb.select().from(dbSchema.paymentIntents)
        .where(eq(dbSchema.paymentIntents.id, input.paymentIntentId));

      if (!intent) throw new TRPCError({ code: "NOT_FOUND", message: "Intent no encontrado" });

      // Check TTL
      if (intent.status === "PENDING_PAYMENT" && new Date() > intent.expiresAt) {
        // Expire it
        await ctx.restaurantDb.update(dbSchema.paymentIntents).set({ status: "EXPIRED" })
          .where(eq(dbSchema.paymentIntents.id, intent.id));
        
        if (intent.orderId) {
          await ctx.restaurantDb.update(orders).set({ status: "EXPIRED" })
            .where(eq(orders.id, intent.orderId));
        }

        return { status: "EXPIRED" };
      }

      return { status: intent.status }; // PENDING_PAYMENT, PAYMENT_VERIFIED, EXPIRED
    }),

  /**
   * Fase 3: Rabbitty Tabs & Comandas activas en tienda / mesa.
   * Obtiene todas las mesas ocupadas con órdenes abiertas y clientes identificados.
   */
  getActiveTabs: protectedProcedure.query(async ({ ctx }) => {
    // 1. Obtener todas las mesas de la sucursal
    const allTables = await ctx.restaurantDb
      .select()
      .from(tablesTable)
      .where(eq(tablesTable.branchId, ctx.branchId))
      .orderBy(asc(tablesTable.number));

    // 2. Obtener sesiones de mesa abiertas
    const openSessions = await ctx.restaurantDb
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.branchId, ctx.branchId), eq(tableSessions.status, "OPEN")));

    // 3. Obtener órdenes PENDING de la sucursal
    const pendingOrders = await ctx.restaurantDb
      .select()
      .from(orders)
      .where(and(eq(orders.branchId, ctx.branchId), eq(orders.status, "PENDING")))
      .orderBy(desc(orders.createdAt));

    // 4. Si hay órdenes con customerId, buscar datos de usuario en coreDb
    const customerIds = Array.from(new Set(
      pendingOrders
        .map((o) => o.customerId)
        .concat(openSessions.map((s) => s.customerId))
        .filter((id): id is string => Boolean(id))
    ));

    let usersMap = new Map<string, { id: string; name: string; phone?: string | null; username?: string | null }>();
    if (customerIds.length > 0) {
      const matchedUsers = await ctx.coreDb
        .select({
          id: coreUsers.id,
          firstName: coreUsers.firstName,
          lastName: coreUsers.lastName,
          username: coreUsers.username,
          phoneNumber: coreUsers.phoneNumber,
        })
        .from(coreUsers)
        .where(inArray(coreUsers.id, customerIds));

      for (const u of matchedUsers) {
        usersMap.set(u.id, {
          id: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter",
          phone: u.phoneNumber,
          username: u.username,
        });
      }
    }

    // 5. Ensamblar lista de Tabs activos vinculando mesa, orden y cliente
    const activeTabs = pendingOrders.map((ord) => {
      const table = allTables.find((t) => t.id === ord.tableId);
      const session = openSessions.find((s) => s.tableId === ord.tableId);
      const resolvedCustomerId = ord.customerId || session?.customerId || null;
      const user = resolvedCustomerId ? usersMap.get(resolvedCustomerId) : null;

      return {
        orderId: ord.id,
        tableId: ord.tableId,
        tableNumber: table?.number ?? null,
        tableLocation: table?.location ?? null,
        orderType: ord.orderType,
        total: Number(ord.total || 0),
        createdAt: ord.createdAt,
        customer: user
          ? {
              id: user.id,
              name: ord.customerName || user.name,
              phone: ord.customerPhone || user.phone,
              username: user.username,
            }
          : ord.customerName || ord.customerPhone
          ? {
              id: resolvedCustomerId,
              name: ord.customerName || "Rabbitter",
              phone: ord.customerPhone || null,
              username: null,
            }
          : null,
      };
    });

    return {
      activeTabs,
      totalActiveCount: activeTabs.length,
    };
  }),

  /**
   * Fase 3: Envío directo de la cuenta digital al móvil del Rabbitter.
   * Despacha enlace de pago (/pay/[orderId]) vía Push nativo (APNs/in-app) o WhatsApp deep-link.
   */
  sendBillToCustomer: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        customerId: z.string().optional(),
        phone: z.string().optional(),
        customerName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Obtener la orden
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.branchId, ctx.branchId)))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada en esta sucursal" });
      }

      // 2. Obtener datos de la sucursal y restaurante para el mensaje
      const [branch] = await ctx.restaurantDb
        .select()
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);

      const [restaurant] = branch
        ? await ctx.restaurantDb
            .select()
            .from(restaurants)
            .where(eq(restaurants.id, branch.restaurantId))
            .limit(1)
        : [null];

      const businessName = restaurant?.name || "Rabbitty";
      const totalFormatted = `$${Number(order.total || 0).toFixed(2)}`;
      const webBillUrl = `https://admin.rabbitty.me/pay/${order.id}`;

      // 3. Vincular cliente a la orden si no estaba vinculado
      if (input.customerId || input.customerName || input.phone) {
        await ctx.restaurantDb
          .update(orders)
          .set({
            customerId: input.customerId || order.customerId,
            customerName: input.customerName || order.customerName,
            customerPhone: input.phone || order.customerPhone,
          })
          .where(eq(orders.id, order.id));
      }

      let pushSent = false;
      const targetUserId = input.customerId || order.customerId;

      // 4. Si el cliente tiene cuenta de usuario (UUID), enviar Push Notification
      if (targetUserId) {
        try {
          await miniappClient.sendNotification({
            userId: targetUserId,
            title: `🧾 Cuenta lista en ${businessName} (${totalFormatted})`,
            message: `Tu cuenta de ${totalFormatted} está lista. Toca aquí para ver el detalle y pagar con Apple Pay, Tarjeta o Bunz.`,
            type: "AFFILIATE",
          });
          pushSent = true;
        } catch (pushErr) {
          console.warn("[SEND_BILL] Push notification error:", pushErr);
        }
      }

      // 5. Preparar deep-link de WhatsApp para entrega omnicanal
      const targetPhone = input.phone || order.customerPhone;
      let whatsappUrl: string | null = null;
      if (targetPhone) {
        const cleanPhone = targetPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
        const msg =
          `¡Hola ${input.customerName || order.customerName || ""}! 🐰\n\n` +
          `Tu cuenta en *${businessName}* por *${totalFormatted}* está lista.\n\n` +
          `Puedes revisarla y pagarla directamente desde tu móvil aquí:\n` +
          `${webBillUrl}\n\n` +
          `¡Acumula Bunz en cada visita! ✨`;
        whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
      }

      return {
        success: true,
        orderId: order.id,
        webBillUrl,
        pushSent,
        whatsappUrl,
        total: Number(order.total || 0),
        customerName: input.customerName || order.customerName || "Rabbitter",
      };
    }),
});
