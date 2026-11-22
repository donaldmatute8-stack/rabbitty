import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { router, adminOnlyProcedure } from "../trpc";
import {
  aggregatorConnections,
  aggregatorWebhookEvents,
  branches,
  menuCategories,
  menuItems,
} from "@rabbitty/database-restaurant/schema";
import {
  pushStoreMenu,
  setStoreStatus,
  uberEatsConfigured,
  uberEatsEnv,
} from "../services/uberEats";

/**
 * ── Conexión con marketplaces (Uber Eats) ──────────────────────────────────
 * Sin credenciales aprobadas por Uber el módulo es inerte: `status` lo dice y
 * `syncMenu` responde con el motivo exacto. Nada de esto toca pedidos.
 */
export const uberEatsRouter = router({
  status: adminOnlyProcedure
    .input(z.object({ branchId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const branchId = input?.branchId ?? ctx.branchId;
      const [connection] = await ctx.restaurantDb
        .select()
        .from(aggregatorConnections)
        .where(
          and(
            eq(aggregatorConnections.provider, "UBER_EATS"),
            eq(aggregatorConnections.branchId, branchId),
          ),
        )
        .limit(1);

      const [branch] = await ctx.restaurantDb
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      const events = await ctx.restaurantDb
        .select({
          id: aggregatorWebhookEvents.id,
          eventType: aggregatorWebhookEvents.eventType,
          externalId: aggregatorWebhookEvents.externalId,
          processed: aggregatorWebhookEvents.processed,
          receivedAt: aggregatorWebhookEvents.receivedAt,
        })
        .from(aggregatorWebhookEvents)
        .where(eq(aggregatorWebhookEvents.provider, "UBER_EATS"))
        .orderBy(desc(aggregatorWebhookEvents.receivedAt))
        .limit(10);

      return {
        configured: uberEatsConfigured(),
        environment: uberEatsEnv(),
        // Qué falta para que Uber pueda mandarnos pedidos.
        missing: uberEatsConfigured()
          ? []
          : ["UBER_EATS_CLIENT_ID", "UBER_EATS_CLIENT_SECRET"],
        branch: branch ?? null,
        connection: connection ?? null,
        recentEvents: events,
      };
    }),

  /** Guarda (o actualiza) la tienda de Uber que corresponde a la sucursal. */
  connect: adminOnlyProcedure
    .input(
      z.object({
        storeId: z.string().min(2).max(120),
        branchId: z.string().optional(),
        deliveryMode: z.enum(["PLATFORM", "BYOC"]).default("PLATFORM"),
        autoAccept: z.boolean().default(false),
        menuSyncEnabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const branchId = input.branchId ?? ctx.branchId;
      const [existing] = await ctx.restaurantDb
        .select({ id: aggregatorConnections.id })
        .from(aggregatorConnections)
        .where(
          and(
            eq(aggregatorConnections.provider, "UBER_EATS"),
            eq(aggregatorConnections.branchId, branchId),
          ),
        )
        .limit(1);

      const values = {
        provider: "UBER_EATS",
        branchId,
        storeId: input.storeId.trim(),
        status: uberEatsConfigured() ? "CONNECTED" : "PENDING",
        deliveryMode: input.deliveryMode,
        autoAccept: input.autoAccept,
        menuSyncEnabled: input.menuSyncEnabled,
        updatedAt: new Date(),
      };

      if (existing?.id) {
        await ctx.restaurantDb
          .update(aggregatorConnections)
          .set(values)
          .where(eq(aggregatorConnections.id, existing.id));
        return { success: true, connectionId: existing.id, updated: true };
      }

      const [created] = await ctx.restaurantDb
        .insert(aggregatorConnections)
        .values({ ...values })
        .returning({ id: aggregatorConnections.id });
      if (!created?.id) throw new Error("AGGREGATOR_CONNECTION_NOT_CREATED");
      return { success: true, connectionId: created.id, updated: false };
    }),

  disconnect: adminOnlyProcedure
    .input(z.object({ branchId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const branchId = input?.branchId ?? ctx.branchId;
      await ctx.restaurantDb
        .update(aggregatorConnections)
        .set({ status: "DISABLED", updatedAt: new Date() })
        .where(
          and(
            eq(aggregatorConnections.provider, "UBER_EATS"),
            eq(aggregatorConnections.branchId, branchId),
          ),
        );
      return { success: true };
    }),

  /**
   * Publica el menú de la sucursal en Uber Eats.
   * Requiere conexión + credenciales. En sandbox sirve para validar el shape.
   */
  syncMenu: adminOnlyProcedure
    .input(z.object({ branchId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const branchId = input?.branchId ?? ctx.branchId;
      if (!uberEatsConfigured()) {
        return {
          success: false,
          reason: "UBER_EATS_NO_CREDENTIALS",
          message:
            "Faltan UBER_EATS_CLIENT_ID / UBER_EATS_CLIENT_SECRET (aprobación de Uber Eats pendiente).",
        };
      }

      const [connection] = await ctx.restaurantDb
        .select()
        .from(aggregatorConnections)
        .where(
          and(
            eq(aggregatorConnections.provider, "UBER_EATS"),
            eq(aggregatorConnections.branchId, branchId),
          ),
        )
        .limit(1);

      if (!connection?.storeId) {
        return {
          success: false,
          reason: "SIN_TIENDA",
          message: "Primero conecta la tienda de Uber Eats (storeId).",
        };
      }

      const categories = await ctx.restaurantDb
        .select({ id: menuCategories.id, name: menuCategories.name, sortOrder: menuCategories.sortOrder })
        .from(menuCategories)
        .where(eq(menuCategories.branchId, branchId));

      const items = await ctx.restaurantDb
        .select({
          id: menuItems.id,
          categoryId: menuItems.categoryId,
          name: menuItems.name,
          description: menuItems.description,
          price: menuItems.price,
          isActive: menuItems.isActive,
          isAvailable: menuItems.isAvailable,
        })
        .from(menuItems)
        .where(eq(menuItems.branchId, branchId));

      const menu = {
        menus: [
          {
            id: `rabbitty-${branchId}`,
            title: { translations: { es: "Menú" } },
            service_availability: [{ day_of_week: "monday" }],
            category_ids: categories.map((c) => `cat-${c.id}`),
            categories: categories.map((c) => ({
              id: `cat-${c.id}`,
              title: { translations: { es: c.name } },
              entities: items
                .filter((i) => i.categoryId === c.id && i.isActive)
                .map((i) => ({
                  id: `item-${i.id}`,
                  title: { translations: { es: i.name } },
                  description: i.description ? { translations: { es: i.description } } : undefined,
                  price_info: { price: Math.round(Number(i.price) * 100), currency_code: "MXN" },
                  suspension_info: i.isAvailable
                    ? undefined
                    : { suspension: { suspend_until: 4102444800 } },
                })),
            })),
          },
        ],
      };

      const result = await pushStoreMenu(connection.storeId, menu);
      if (!result.ok) {
        return {
          success: false,
          reason: "UBER_MENU_SYNC_FAILED",
          message: result.error ?? `HTTP ${result.status}`,
        };
      }

      await ctx.restaurantDb
        .update(aggregatorConnections)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(aggregatorConnections.id, connection.id));

      return { success: true, storeId: connection.storeId };
    }),

  /** Abre o pausa la tienda en Uber (online/offline). */
  setOnline: adminOnlyProcedure
    .input(z.object({ online: z.boolean(), branchId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const branchId = input.branchId ?? ctx.branchId;
      const [connection] = await ctx.restaurantDb
        .select()
        .from(aggregatorConnections)
        .where(
          and(
            eq(aggregatorConnections.provider, "UBER_EATS"),
            eq(aggregatorConnections.branchId, branchId),
          ),
        )
        .limit(1);
      if (!connection?.storeId) {
        return { success: false, reason: "SIN_TIENDA" as const };
      }
      const result = await setStoreStatus(connection.storeId, input.online ? "ONLINE" : "OFFLINE");
      return {
        success: result.ok,
        reason: result.ok ? null : result.error ?? `HTTP ${result.status}`,
      };
    }),
});
