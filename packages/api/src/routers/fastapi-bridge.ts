import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { bus, EventTypes } from "@rabbitty/events";
import { miniappClient, configureMiniapp, getMiniappConfig } from "../services/miniapp-client";
import { ownedBusinesses } from "@rabbitty/database-core";
import { TRPCError } from "@trpc/server";

export const fastapiBridgeRouter = router({
  configure: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        apiKey: z.string().optional(),
        timeout: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiSecret = input.apiKey || process.env.RABBITTY_API_SECRET || "";
      configureMiniapp(input.url, apiSecret);
      return { success: true, url: input.url, timeout: input.timeout ?? 30000, isActive: true };
    }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const cfg = getMiniappConfig();
    if (cfg) {
      return { url: cfg.url, apiKey: "••••", timeout: 30000, isActive: true };
    }
    const url = process.env.RABBITTY_MINIAPP_URL || "";
    const isActive = !!(url && process.env.RABBITTY_API_SECRET);
    return { url, apiKey: null, timeout: 30000, isActive };
  }),

  testConnection: protectedProcedure.query(async ({ ctx }) => {
    const connected = await miniappClient.testConnection();
    return { connected, uptime: connected ? "OK" : "No disponible" };
  }),

  syncPaidOrder: protectedProcedure
    .input(z.object({ orderId: z.string(), customerPhone: z.string().optional(), amount: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      bus.emit(EventTypes.ORDER_PAID, { orderId: input.orderId });

      if (input.customerPhone && input.amount) {
        try {
          const result = await miniappClient.rewardBunz(input.customerPhone, input.amount, input.orderId);
          return { success: true, bunzRewarded: result.bunz, message: result.message };
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al recompensar Bunz: ${e.message}` });
        }
      }

      return { success: true, bunzRewarded: 0, message: "Orden registrada sin recompensa" };
    }),

  syncBunzReward: protectedProcedure
    .input(z.object({ customerId: z.string(), rewardPoints: z.number(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      bus.emit(EventTypes.BUNZ_REWARD, { customerId: input.customerId, rewardPoints: input.rewardPoints });

      if (input.phone) {
        try {
          const result = await miniappClient.rewardBunz(input.phone, input.rewardPoints);
          return { success: true, bunzRewarded: result.bunz, message: result.message };
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al recompensar Bunz: ${e.message}` });
        }
      }

      return { success: true, bunzRewarded: input.rewardPoints, message: "Evento emitido" };
    }),

  syncRestaurant: protectedProcedure
    .input(
      z.object({
        restaurantId: z.string(),
        name: z.string(),
        slug: z.string(),
        acceptsBunz: z.boolean().optional(),
        ownerTelegramId: z.string().optional(),
        address: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.ownerTelegramId) {
        return { success: true, message: "Sin ownerTelegramId, omitiendo sync con miniapp" };
      }

      try {
        const existing = await miniappClient.getBusiness(input.ownerTelegramId);
        if (existing.business) {
          return { success: true, message: "Negocio ya existe en miniapp", businessId: existing.business.id };
        }

        const created = await miniappClient.createBusiness({
          name: input.name,
          category: input.category || "Restaurante",
          address: input.address || "",
          rewardPercentage: 10,
          telegramId: input.ownerTelegramId,
        });

        return { success: true, message: "Negocio sincronizado con miniapp", businessId: created.business.id };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al sincronizar negocio: ${e.message}` });
      }
    }),

  getBunzBalance: protectedProcedure
    .input(z.object({ telegramId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const txs = await miniappClient.getBusinessTransactions(input.telegramId);
        return { success: true, telegramId: input.telegramId, transactions: txs.transactions };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al obtener balance: ${e.message}` });
      }
    }),

  getTransactionHistory: protectedProcedure
    .input(z.object({ telegramId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const history = await miniappClient.getHistory(input.telegramId);
        return { success: true, history: history.history };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al obtener historial: ${e.message}` });
      }
    }),

  chargeBunz: protectedProcedure
    .input(z.object({ rabbittyId: z.string(), amountUsd: z.number(), orderId: z.string().optional(), businessId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await miniappClient.chargeBunz(input.rabbittyId, input.amountUsd, input.orderId, input.businessId);
        return { success: true, balanceRemaining: result.balance_remaining, message: result.message };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al cobrar Bunz: ${e.message}` });
      }
    }),

  mintBunz: protectedProcedure
    .input(z.object({ telegramId: z.string(), businessId: z.string(), fiatAmount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await miniappClient.mintBunz(input.telegramId, input.businessId, input.fiatAmount);
        return { success: true, bunzRewarded: result.bunzRewarded };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al mintear Bunz: ${e.message}` });
      }
    }),

  rechargeBusinessBunz: protectedProcedure
    .input(z.object({
      businessId: z.string(),
      amount: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [business] = await ctx.coreDb.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, input.businessId));
      if (!business) throw new TRPCError({ code: "NOT_FOUND", message: "Negocio no encontrado" });

      await ctx.coreDb.update(ownedBusinesses)
        .set({ bunzBalance: sql`${ownedBusinesses.bunzBalance} + ${input.amount}` })
        .where(eq(ownedBusinesses.id, input.businessId));

      return { success: true, bunzBalance: business.bunzBalance + input.amount };
    }),

  onEvent: protectedProcedure
    .input(
      z.object({
        event: z.string(),
        data: z.record(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      bus.emit(input.event, input.data);
      return { success: true };
    }),
});
