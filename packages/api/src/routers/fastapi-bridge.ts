import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { router, godAdminProcedure, protectedProcedure } from "../trpc";
import { bus, EventTypes } from "@rabbitty/events";
import { miniappClient, configureMiniapp, getMiniappConfig } from "../services/miniapp-client";
import { ownedBusinesses } from "@rabbitty/database-core";
import { ledgerEntries } from "@rabbitty/database-restaurant/schema";
import { biz, sys } from "../services/ledgerSubjects";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";

export const fastapiBridgeRouter = router({
  configure: godAdminProcedure
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
      // ── Guard: cobrar Bunz solo al negocio propio (o God Admin) ──
      if (input.businessId && !ctx.god2faVerified) {
        const [owned] = await ctx.coreDb
          .select({ id: ownedBusinesses.id })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.ownerId, ctx.userId ?? ""))
          .limit(1);
        if (!owned || owned.id !== input.businessId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo puedes cobrar Bunz de tu propio negocio." });
        }
      }
      try {
        const result = await miniappClient.chargeBunz(input.rabbittyId, input.amountUsd, input.orderId, input.businessId);
        return { success: true, balanceRemaining: result.balance_remaining, message: result.message };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al cobrar Bunz: ${e.message}` });
      }
    }),

  mintBunz: godAdminProcedure
    .input(z.object({ telegramId: z.string(), businessId: z.string(), fiatAmount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await miniappClient.mintBunz(input.telegramId, input.businessId, input.fiatAmount);
        return { success: true, bunzRewarded: result.bunzRewarded };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al mintear Bunz: ${e.message}` });
      }
    }),

  /**
   * W4 (auditoría H17) — Refill de respaldo del afiliado.
   *
   * Crear capacidad de redención es una operación económica: el modelo §0 exige
   * "fuente documentada y aprobada (actor + motivo)". Antes esta ruta sumaba
   * `bunzBalance` sin actor, sin motivo y sin registro contable — imposible de
   * auditar y de conciliar (D-14/D-17).
   *
   * Orden de escritura: primero el asiento de ledger, después el balance. Si el
   * balance falla, queda una entrada huérfana DETECTABLE; al revés quedaría
   * respaldo emitido sin registro, que es peor. No hay transacción cruzada
   * posible (core y restaurant son bases distintas).
   */
  rechargeBusinessBunz: godAdminProcedure
    .input(z.object({
      businessId: z.string(),
      amount: z.number().int().positive(),
      /** Motivo obligatorio: es la "fuente documentada y aprobada" del modelo. */
      reason: z.string().trim().min(5).max(500),
      /** Idempotencia opcional para reintentos del cliente. */
      idempotencyKey: z.string().min(8).max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [business] = await ctx.coreDb.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, input.businessId));
      if (!business) throw new TRPCError({ code: "NOT_FOUND", message: "Negocio no encontrado" });

      let vData: Record<string, unknown> = {};
      try {
        if (business.verificationData) {
          vData = JSON.parse(business.verificationData);
        }
      } catch {}

      if ('lastLowIncentiveAlertAt' in vData) {
        delete vData.lastLowIncentiveAlertAt;
      }

      const actorId = ctx.userId ?? "SYSTEM";
      const idempotencyKey = input.idempotencyKey ?? `refill_${input.businessId}_${crypto.randomUUID()}`;

      // 1) Registro contable del incremento de respaldo (actor + motivo + origen).
      // MINT canónico: sys_treasury → biz_<ownedBusinesses.id>.
      // El actor (quién ejecuta el refill) va en metadata, no como sujeto.
      try {
        await ctx.restaurantDb.insert(ledgerEntries).values({
          payerSubjectId: sys("treasury"),
          payeeSubjectId: biz(input.businessId),
          amount: input.amount,
          currency: "BUNZ",
          sandbox: business.sandbox === true,
          type: "MINT",
          referenceId: input.businessId,
          idempotencyKey,
          metadata: {
            kind: "BACKING_REFILL",
            reason: input.reason,
            actorId,
            actorRole: "GOD_ADMIN",
            previousBalance: business.bunzBalance ?? 0,
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          throw new TRPCError({ code: "CONFLICT", message: "Esta recarga ya fue registrada (idempotencia)." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `No se pudo registrar la recarga en el ledger: ${msg}` });
      }

      // 2) Incremento del respaldo disponible, devolviendo el saldo real.
      const [updated] = await ctx.coreDb.update(ownedBusinesses)
        .set({
          bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) + ${input.amount}`,
          verificationData: JSON.stringify(vData),
        })
        .where(eq(ownedBusinesses.id, input.businessId))
        .returning({ bunzBalance: ownedBusinesses.bunzBalance });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Recarga registrada en ledger (${idempotencyKey}) pero el balance no se actualizó. Requiere corrección manual.`,
        });
      }

      return { success: true, bunzBalance: updated.bunzBalance ?? 0, idempotencyKey };
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
