import { z } from "zod";
import { and, eq, inArray, gte, lt, sql, desc } from "drizzle-orm";
import { router, protectedProcedure, adminOnlyProcedure, platformOnlyProcedure, godAdminProcedure, resolveBranchId } from "../trpc";
import { TRPCError } from "@trpc/server";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { restaurants, branches, orders, tables, staff, ledgerEntries, menuCategories, menuItems } from "@rabbitty/database-restaurant/schema";
import { referrals, users, levels, ownedBusinesses, transactions, treasury, systemSettings, auditEntries } from "@rabbitty/database-core";
import { customers } from "@rabbitty/database-restaurant/schema";
import { miniappClient } from "../services/miniapp-client";
import * as cheerio from "cheerio";
export const adminRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return {
      userId: ctx.userId,
      role: ctx.staffRole ?? "OWNER",
      branchId: ctx.staffBranchId,
    };
  }),

  getPendingBusinesses: godAdminProcedure.query(async ({ ctx }) => {
    const list = await ctx.coreDb
      .select({
        id: ownedBusinesses.id,
        ownerId: ownedBusinesses.ownerId,
        name: ownedBusinesses.name,
        category: ownedBusinesses.category,
        description: ownedBusinesses.description,
        address: ownedBusinesses.address,
        rewardPercentage: ownedBusinesses.rewardPercentage,
        package: ownedBusinesses.package,
        creditLimit: ownedBusinesses.creditLimit,
        status: ownedBusinesses.status,
        createdAt: ownedBusinesses.createdAt,
        ownerName: users.firstName,
        ownerUsername: users.username,
        ownerPhone: users.phoneNumber,
        ownerEmail: users.email,
        ownerTelegramId: users.telegramId,
      })
      .from(ownedBusinesses)
      .leftJoin(users, eq(ownedBusinesses.ownerId, users.id));
    return list;
  }),

  approveOwnedBusiness: godAdminProcedure
    .input(z.object({ id: z.string(), status: z.enum(["APPROVED", "VERIFIED", "REJECTED"]) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.coreDb
        .update(ownedBusinesses)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(ownedBusinesses.id, input.id))
        .returning();

      if (updated && (input.status === "APPROVED" || input.status === "VERIFIED")) {
        try {
          const [owner] = await ctx.coreDb.select().from(users).where(eq(users.id, updated.ownerId));
          const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.AUTH_TELEGRAM_BOT_TOKEN;
          if (owner?.telegramId && botToken) {
            const message =
              `🎉 *¡Felicidades! Tu negocio ${updated.name} ha sido aprobado.*\n\n` +
              `Ya estás listo para operar en Rabbitty. Tus clientes ya pueden escanear y ganar Bunz en tu establecimiento.\n\n` +
              `🐰 — Rabbitty Team`;

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: owner.telegramId,
                text: message,
                parse_mode: "Markdown",
                disable_web_page_preview: true,
              }),
            });
          }
        } catch (e) {
          console.error("Error sending owner approval notification:", e);
        }
      }

      return { success: true };
    }),

  // Owners ven todos; ADMIN/MANAGER (staff con PIN) solo el restaurante de su sucursal.
  getRestaurants: adminOnlyProcedure.query(async ({ ctx }) => {
    if (ctx.staffRole && ctx.staffBranchId) {
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.staffBranchId));
      if (!branch?.restaurantId) return [];
      return ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
    }
    const result = await ctx.restaurantDb.select().from(restaurants);
    return result;
  }),

  updateRestaurant: adminOnlyProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        // Slug ASCII estricto: a-z0-9 con guiones — evita QRs/startapp rotos
        slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/, "Slug inválido (usa minúsculas, números y guiones)").optional(),
        currency: z.string().optional(),
        taxRate: z.number().optional(),
        timezone: z.string().optional(),
        defaultRewardRate: z.number().optional(),
        acceptsBunz: z.boolean().optional(),
        happyHourStart: z.string().optional().nullable(),
        happyHourEnd: z.string().optional().nullable(),
        happyHourRewardRate: z.number().optional().nullable(),
        printerType: z.string().optional().nullable(),
        printerConfig: z.any().optional().nullable(),
        legalName: z.string().optional().nullable(),
        rfc: z.string().optional().nullable(),
        taxRegime: z.string().optional().nullable(),
        logoUrl: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        ticketFooter: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ── Guard de ownership (IDOR): permitido solo si
      //    (a) tiene staff vinculado a sucursales de este restaurante, o
      //    (b) es dueño del negocio que lo posee, o
      //    (c) es God Admin identificado.
      const staffRows = await ctx.restaurantDb
        .select({ branchId: staff.branchId })
        .from(staff)
        .where(eq(staff.userId, ctx.userId));
      const branchIds = staffRows.map((s) => s.branchId).filter(Boolean);
      let allowed = false;
      if (branchIds.length > 0) {
        const branchRows = await ctx.restaurantDb
          .select({ restaurantId: branches.restaurantId })
          .from(branches)
          .where(inArray(branches.id, branchIds));
        const allowedIds = branchRows.map((b) => b.restaurantId).filter(Boolean);
        allowed = allowedIds.includes(input.id);
      }
      if (!allowed) {
        // ¿Dueño del negocio dueño del restaurante?
        const [restRow] = await ctx.restaurantDb
          .select({ businessId: restaurants.businessId })
          .from(restaurants)
          .where(eq(restaurants.id, input.id))
          .limit(1);
        if (restRow?.businessId) {
          const [owned] = await ctx.coreDb
            .select({ id: ownedBusinesses.id })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.ownerId, ctx.userId ?? ""))
            .limit(1);
          allowed = Boolean(owned && owned.id === restRow.businessId);
        }
        if (!allowed && ctx.god2faVerified) {
          const { isGodAdminIdentity } = await import("../services/god2fa");
          allowed = isGodAdminIdentity(ctx.user?.email, ctx.user?.name);
        }
      }
      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permisos para modificar este restaurante." });
      }

      const updateData = { ...input } as any;
      delete updateData.address; // Don't save address on restaurants table
      await ctx.restaurantDb.update(restaurants).set(updateData).where(eq(restaurants.id, input.id));

      if (input.address !== undefined) {
        if (branchIds.length > 0) {
          // Update the specific branches the user has access to
          await ctx.restaurantDb.update(branches).set({ address: input.address || "" }).where(inArray(branches.id, branchIds));
        } else {
          // Admin mode (no specific branch assigned): update all branches of this restaurant
          await ctx.restaurantDb.update(branches).set({ address: input.address || "" }).where(eq(branches.restaurantId, input.id));
        }
      }

      // Auto-sync directo a la tabla unificada ownedBusinesses (Fuente única de la verdad)
      try {
        const [updated] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, input.id));
        if (updated) {
          const rate = typeof updated.defaultRewardRate === "number" && updated.defaultRewardRate > 0 && updated.defaultRewardRate < 1
            ? Math.round(updated.defaultRewardRate * 100)
            : updated.defaultRewardRate;

          if (typeof rate === "number" && rate > 0) {
            // Sincronizar en coreDb: por businessId si existe o por ownerId/nombre del restaurante
            await ctx.coreDb
              .update(ownedBusinesses)
              .set({
                rewardPercentage: rate,
                name: updated.name || undefined,
                updatedAt: new Date(),
              })
              .where(
                updated.businessId && updated.businessId !== "rabbitty-main"
                  ? eq(ownedBusinesses.id, updated.businessId)
                  : eq(ownedBusinesses.ownerId, ctx.userId)
              );
          }
        }
      } catch (syncErr) {
        console.warn("[Admin Sync] Error actualizando ownedBusinesses desde updateRestaurant:", syncErr);
      }

      return { success: true };

    }),

  verifyBusiness: godAdminProcedure
    .input(z.object({ businessId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.businessId, input.businessId));
      if (restaurant) {
        await ctx.restaurantDb.update(restaurants).set({ isActive: true }).where(eq(restaurants.id, restaurant.id));
        return { success: true, restaurantId: restaurant.id };
      }
      return { success: false };
    }),

  createCategory: adminOnlyProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.restaurantDb.insert(dbSchema.menuCategories).values({
        branchId: await resolveBranchId(ctx, undefined),
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      }).returning();
      return category;
    }),

  updateCategory: adminOnlyProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.restaurantDb
        .select({ id: dbSchema.menuCategories.id })
        .from(dbSchema.menuCategories)
        .where(and(eq(dbSchema.menuCategories.id, input.id), eq(dbSchema.menuCategories.branchId, await resolveBranchId(ctx, undefined))));
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Categoría no encontrada en esta sucursal" });
      }
      await ctx.restaurantDb.update(dbSchema.menuCategories).set(input).where(eq(dbSchema.menuCategories.id, input.id));
      return { success: true };
    }),

  deleteCategory: adminOnlyProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.restaurantDb
        .select({ id: dbSchema.menuCategories.id })
        .from(dbSchema.menuCategories)
        .where(and(eq(dbSchema.menuCategories.id, input.id), eq(dbSchema.menuCategories.branchId, await resolveBranchId(ctx, undefined))));
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Categoría no encontrada en esta sucursal" });
      }
      await ctx.restaurantDb.delete(dbSchema.menuCategories).where(eq(dbSchema.menuCategories.id, input.id));
      return { success: true };
    }),

  createMenuItem: adminOnlyProcedure
    .input(
      z.object({
        categoryId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number(),
        cost: z.number().optional(),
        imageUrl: z.string().optional(),
        sku: z.string().optional(),
        isAvailable: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [menuItem] = await ctx.restaurantDb.insert(dbSchema.menuItems).values({
        categoryId: input.categoryId,
        branchId: await resolveBranchId(ctx, undefined),
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        cost: input.cost ?? 0,
        imageUrl: input.imageUrl ?? null,
        sku: input.sku ?? null,
        isAvailable: input.isAvailable ?? true,
        sortOrder: input.sortOrder ?? 0,
      }).returning();
      return menuItem;
    }),

  updateMenuItem: adminOnlyProcedure
    .input(
      z.object({
        id: z.string(),
        categoryId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        cost: z.number().optional(),
        imageUrl: z.string().optional(),
        sku: z.string().optional(),
        isAvailable: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.restaurantDb
        .select({ id: dbSchema.menuItems.id })
        .from(dbSchema.menuItems)
        .where(and(eq(dbSchema.menuItems.id, input.id), eq(dbSchema.menuItems.branchId, await resolveBranchId(ctx, undefined))));
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Platillo no encontrado en esta sucursal" });
      }
      await ctx.restaurantDb.update(dbSchema.menuItems).set(input).where(eq(dbSchema.menuItems.id, input.id));
      return { success: true };
    }),

  deleteMenuItem: adminOnlyProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.restaurantDb
        .select({ id: dbSchema.menuItems.id })
        .from(dbSchema.menuItems)
        .where(and(eq(dbSchema.menuItems.id, input.id), eq(dbSchema.menuItems.branchId, await resolveBranchId(ctx, undefined))));
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Platillo no encontrado en esta sucursal" });
      }
      await ctx.restaurantDb.delete(dbSchema.menuItems).where(eq(dbSchema.menuItems.id, input.id));
      return { success: true };
    }),

  getSalesReport: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      end.setDate(end.getDate() + 1);

      const result = await ctx.restaurantDb.select().from(orders).where(
        and(
          eq(orders.branchId, ctx.branchId),
          gte(orders.createdAt, start),
          lt(orders.createdAt, end)
        )
      );
      const totalSales = result.reduce((sum, order) => sum + order.total, 0);
      const totalOrders = result.length;
      return { totalSales, totalOrders };
    }),

  importUberEatsMenu: adminOnlyProcedure
    .input(z.object({ branchId: z.string(), url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const branchId = await resolveBranchId(ctx, input.branchId);
        const response = await fetch(input.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-MX,es;q=0.8,en-US;q=0.5,en;q=0.3"
          }
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch UberEats URL");
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Intento de extraer el schema JSON-LD que contiene el menú
        const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
        let menuData: any = null;

        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse($(script).html() || "{}");
            // Usualmente el schema principal de Restaurant tiene hasMenu
            if (data["@type"] === "Restaurant" && data.hasMenu) {
              menuData = data.hasMenu;
              break;
            } else if (data["@type"] === "Menu") {
              menuData = data;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        // Si falló el JSON-LD estricto, aplicamos una extracción "Mock" inteligente o fallback
        if (!menuData || !menuData.hasMenuSection) {
          // Extraer desde el estado inicial de la app en la página de Uber si existe
          const fallbackData = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
          if (fallbackData && fallbackData[1]) {
             // Es demasiado grande para parsear fácilmente, usaremos un mock inteligente de las categorías que sí pudimos scrapear por tags HTML
          }
          
          // Extracción por clases CSS/DOM real si no hay JSON-LD
          const categories: { name: string; items: any[] }[] = [];
          
          // UberEats normalmente envuelve las categorías en listas o divs con headers
          $('ul, [data-testid="rich-text"]').each((i: number, el: any) => {
            const heading = $(el).prev('h2').text().trim() || $(el).find('h2').first().text().trim();
            if (heading && heading.length < 40 && !heading.includes("Uber")) {
              const items: any[] = [];
              
              // Buscar elementos que parezcan productos (li o divs con rol listitem)
              $(el).find('li, [role="listitem"]').each((j: number, itemEl: any) => {
                const textContent = $(itemEl).text();
                // Buscar precios con regex
                const priceMatch = textContent.match(/\$?\s*(\d+[.,]\d{2})/);
                const price = priceMatch && priceMatch[1] ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
                
                // Buscar nombres (generalmente están en un span o div prominente al inicio)
                const possibleNames = $(itemEl).find('span, div').filter((k: number, e: any) => {
                  const t = $(e).text().trim();
                  return t.length > 2 && t.length < 60 && !t.match(/\$?\s*(\d+[.,]\d{2})/);
                }).first().text().trim();
                
                if (possibleNames && price > 0) {
                  items.push({
                    name: possibleNames,
                    price,
                    description: textContent.replace(possibleNames, '').replace(priceMatch && priceMatch[0] ? priceMatch[0] : '', '').substring(0, 255).trim()
                  });
                }
              });

              if (items.length > 0) {
                categories.push({ name: heading, items });
              }
            }
          });

          if (categories.length === 0) {
            throw new Error("No pudimos extraer el menú automáticamente debido a las protecciones de UberEats. Intenta copiar y pegar los platillos.");
          }

          let sortOrder = 0;
          let itemsCount = 0;

          for (const category of categories) {
            const [cat] = await ctx.restaurantDb.insert(dbSchema.menuCategories).values({
              branchId,
              name: category.name,
              sortOrder: sortOrder++,
            }).returning();

            if (!cat) throw new Error("Failed to create category");

            if (category.items.length > 0) {
              const itemsToInsert = category.items.map((item, index) => ({
                categoryId: cat.id,
                branchId,
                name: item.name,
                price: item.price,
                description: item.description || null,
                sortOrder: index,
              }));
              
              await ctx.restaurantDb.insert(dbSchema.menuItems).values(itemsToInsert);
              itemsCount += category.items.length;
            }
          }
          
          return { success: true, message: `Scraping por DOM exitoso: ${categories.length} categorías y ${itemsCount} platillos creados.` };
        }

        // Si tenemos JSON-LD (ideal)
        let sortOrder = 0;
        let itemsCount = 0;
        const sections = Array.isArray(menuData.hasMenuSection) ? menuData.hasMenuSection : [menuData.hasMenuSection];

        for (const section of sections) {
          const [cat] = await ctx.restaurantDb.insert(dbSchema.menuCategories).values({
            branchId,
            name: section.name || "Categoría Importada",
            sortOrder: sortOrder++,
          }).returning();

          if (!cat) {
            throw new Error("Failed to create category");
          }

          if (section.hasMenuItem && Array.isArray(section.hasMenuItem)) {
            for (const item of section.hasMenuItem) {
              const priceMatch = item.offers?.price ? Number(item.offers.price) : 100;
              await ctx.restaurantDb.insert(dbSchema.menuItems).values({
                categoryId: cat.id,
                branchId,
                name: item.name,
                description: item.description?.substring(0, 255) || null,
                price: priceMatch,
                imageUrl: item.image || null,
                sortOrder: itemsCount++,
              });
            }
          }
        }

        return { success: true, message: `¡Menú importado! ${sections.length} categorías y ${itemsCount} platillos extraídos.` };
      } catch (err) {
        throw new Error("No pudimos extraer el menú automáticamente debido a protecciones contra bots.");
      }
    }),

  getBranches: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.staffRole && ctx.staffBranchId) {
      return await ctx.restaurantDb.select().from(branches).where(and(eq(branches.id, ctx.staffBranchId), eq(branches.isActive, true)));
    }
    // ── Multi-tenant guard: un OWNER (no staff) solo ve las branches de SU negocio ──
    if (ctx.userId) {
      const coreOwned = await import("@rabbitty/database-core/schema").then(m => m.ownedBusinesses);
      const ownerBiz = await ctx.coreDb.select().from(coreOwned)
        .where(eq(coreOwned.ownerId, ctx.userId)).limit(1).catch(() => []);
      if (ownerBiz[0]?.id) {
        const ownRest = await ctx.restaurantDb.select({ id: restaurants.id }).from(restaurants)
          .where(eq(restaurants.businessId, ownerBiz[0].id));
        if (ownRest[0]?.id) {
          return await ctx.restaurantDb.select().from(branches)
            .where(and(eq(branches.restaurantId, ownRest[0].id), eq(branches.isActive, true)));
        }
        return [];
      }
    }
    return await ctx.restaurantDb.select().from(branches).where(eq(branches.isActive, true));
  }),

  getCrossStoreKpis: protectedProcedure.query(async ({ ctx }) => {
    let allBranches = await ctx.restaurantDb.select().from(branches);
    if (ctx.staffRole && ctx.staffBranchId) {
      allBranches = allBranches.filter(b => b.id === ctx.staffBranchId);
    }
    // Excluir sucursales de entrenamiento (Sandbox) del consolidado financiero Multi-Sucursal de producción
    allBranches = allBranches.filter(
      (b) => !b.name.toLowerCase().includes("sandbox") && !b.name.toLowerCase().includes("entrenamiento")
    );

    const branchKpis = await Promise.all(
      allBranches.map(async (branch) => {
        const [ordersResult, revenueResult] = await Promise.all([
          ctx.restaurantDb.select().from(orders).where(eq(orders.branchId, branch.id)),
          ctx.restaurantDb.select({ sum: orders.total }).from(orders).where(eq(orders.branchId, branch.id)),
        ]);
        return {
          branchId: branch.id,
          branchName: branch.name,
          totalOrders: ordersResult.length,
          totalRevenue: Number(revenueResult[0]?.sum ?? 0),
          totalCustomers: new Set(ordersResult.map((o) => o.customerPhone).filter(Boolean)).size,
          lastOrderAt: ordersResult.length > 0
            ? ordersResult.reduce((latest, o) =>
                o.createdAt && (!latest || o.createdAt > latest) ? o.createdAt : latest,
                null as Date | null
              )
            : null,
        };
      })
    );

    const totals = branchKpis.reduce(
      (acc, b) => ({
        totalOrders: acc.totalOrders + b.totalOrders,
        totalRevenue: acc.totalRevenue + b.totalRevenue,
        totalCustomers: acc.totalCustomers + b.totalCustomers,
      }),
      { totalOrders: 0, totalRevenue: 0, totalCustomers: 0 }
    );

    return {
      totals,
      branches: branchKpis,
      branchCount: allBranches.length,
    };
  }),

  getReferralAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const allReferrals = await ctx.coreDb.select().from(referrals);
    const totalInviters = new Set(allReferrals.map((r) => r.inviterId)).size;
    const totalInvited = new Set(allReferrals.map((r) => r.invitedId)).size;
    return { referrals: allReferrals, totalInviters, totalInvited };
  }),

  getLoyaltyStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const allUsers = await ctx.coreDb.select().from(users);
      const allLevels = await ctx.coreDb.select().from(levels);
      const totalBunzEarned = allUsers.reduce((s, u) => s + (u.totalBunzEarned ?? 0), 0);
      const totalSpent = allUsers.reduce((s, u) => s + (u.totalBunzSpent ?? 0), 0);
      const totalHops = allUsers.reduce((s, u) => s + (u.hops ?? 0), 0);
      // Sort on a copy to avoid mutating the original array
      const topUsers = [...allUsers].sort((a, b) => (b.hops ?? 0) - (a.hops ?? 0)).slice(0, 10);
      const levelsWithCount = allLevels.map((l) => ({
        ...l,
        userCount: allUsers.filter((u) => u.levelId === l.id).length,
      }));
      return {
        totalUsers: allUsers.length,
        totalBunzEarned,
        totalSpent,
        totalHops,
        levels: levelsWithCount,
        topUsers,
      };
    } catch (err) {
      // Return safe defaults so the loyalty page renders with mock data instead of crashing
      console.error("[getLoyaltyStats] DB error:", err);
      return {
        totalUsers: 0,
        totalBunzEarned: 0,
        totalSpent: 0,
        totalHops: 0,
        levels: [],
        topUsers: [],
      };
    }
  }),

  getBirthdaySettings: protectedProcedure.query(async ({ ctx }) => {
    const [restaurant] = await ctx.restaurantDb.select().from(restaurants).limit(1);
    return {
      birthdayBonusBunz: (restaurant as any)?.birthdayBonusBunz ?? 100,
      birthdayMessageTemplate: "¡Feliz cumpleaños {name}! 🎂 Como regalo, te hemos acreditado {bonus} Bunz. ¡Disfruta tu día!",
      isActive: true,
    };
  }),

  updateBirthdaySettings: adminOnlyProcedure
    .input(z.object({
      birthdayBonusBunz: z.number().min(0).default(100),
      birthdayMessageTemplate: z.string().default("¡Feliz cumpleaños {name}! 🎂 Como regalo, te hemos acreditado {bonus} Bunz. ¡Disfruta tu día!"),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const [restaurant] = await ctx.restaurantDb.select().from(restaurants).limit(1);
      if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "No restaurant found" });
      await ctx.restaurantDb.update(restaurants).set(input as any).where(eq(restaurants.id, restaurant.id));
      return { success: true };
    }),

  getUpcomingBirthdays: protectedProcedure.query(async ({ ctx }) => {
    const [restaurant] = await ctx.restaurantDb.select().from(restaurants).limit(1);
    if (!restaurant) return [];
    const allCustomers = await ctx.restaurantDb
      .select()
      .from(customers)
      .where(sql`${customers.birthDate} IS NOT NULL`)
      .orderBy(customers.birthDate)
      .limit(50);
    const today = new Date();
    return allCustomers.map((c) => ({
      ...c,
      daysUntilBirthday: c.birthDate
        ? (new Date(today.getFullYear(), c.birthDate.getMonth(), c.birthDate.getDate()).getTime() - today.getTime()) / 86400000
        : null,
    })).sort((a, b) => (a.daysUntilBirthday ?? 999) - (b.daysUntilBirthday ?? 999));
  }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalOrdersResult, totalRevenueResult, activeTablesResult] = await Promise.all([
      ctx.restaurantDb.select().from(orders).where(eq(orders.branchId, ctx.branchId)),
      ctx.restaurantDb.select({ sum: orders.total }).from(orders).where(eq(orders.branchId, ctx.branchId)),
      ctx.restaurantDb.select().from(tables).where(eq(tables.branchId, ctx.branchId)),
    ]);
    
    const totalOrders = totalOrdersResult.length;
    const totalRevenue = Number(totalRevenueResult[0]?.sum ?? 0);
    const activeTables = activeTablesResult.length;
    
    const totalCustomersResult = await ctx.restaurantDb.select({ count: orders.id }).from(orders).where(eq(orders.branchId, ctx.branchId));
    const totalCustomers = Number(totalCustomersResult[0]?.count ?? 0);
    
    return {
      totalOrders,
      totalRevenue,
      activeTables,
      totalCustomers,
    };
  }),

  sendFeedback: protectedProcedure
    .input(
      z.object({
        type: z.enum(["BUG", "FEEDBACK"]),
        title: z.string().optional(),
        message: z.string().min(1),
        url: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminTelegramIds = (process.env.ADMIN_TELEGRAM_IDS || "798431743")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.AUTH_TELEGRAM_BOT_TOKEN;

      const tag = input.type === "BUG" ? "🐞 REPORTE DE ERROR (ADMIN/POS)" : "💡 FEEDBACK DE AFILIADO";
      const userEmail = ctx.user?.email || "Usuario Admin";
      const branchId = ctx.branchId || "N/A";

      const cleanTitle = (input.title || (input.type === "BUG" ? "Error reportado" : "Sugerencia")).trim();
      const cleanMessage = input.message.trim();
      const originUrl = input.url || "Panel Admin";

      // Plain text / safe message to prevent Telegram Markdown parsing rejections
      const safeText =
        `${tag}\n\n` +
        `📌 Título: ${cleanTitle}\n` +
        `📝 Detalle:\n${cleanMessage}\n\n` +
        `👤 Remitente: ${userEmail} (Sucursal: ${branchId})\n` +
        `🌐 Ruta: ${originUrl}`;

      if (botToken) {
        for (const adminId of adminTelegramIds) {
          try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminId,
                text: safeText,
                disable_web_page_preview: true,
              }),
            });
            if (!res.ok) {
              const errBody = await res.text();
              console.error(`[AdminFeedback] Telegram dispatch failed (${res.status}):`, errBody);
            }
          } catch (tErr) {
            console.error("[AdminFeedback] Telegram dispatch error:", tErr);
          }
        }
      } else {
        console.warn("[AdminFeedback] No Telegram Bot Token configured in environment.");
      }

      return { success: true };
    }),

  /**
   * Consulta de inventario y estado de Bunz para el comercio/afiliado autenticado.
   * Usado en apps/admin (Mac, iPad, Web) y POS para mostrar la bóveda de Bunz disponible.
   */
  getAffiliateBunzInventory: protectedProcedure.query(async ({ ctx }) => {
    try {
      // 1. Intentar resolver por ctx.userId (Core user ID)
      let [biz] = ctx.userId
        ? await ctx.coreDb
            .select({
              id: ownedBusinesses.id,
              name: ownedBusinesses.name,
              category: ownedBusinesses.category,
              bunzBalance: ownedBusinesses.bunzBalance,
              package: ownedBusinesses.package,
              rewardPercentage: ownedBusinesses.rewardPercentage,
              status: ownedBusinesses.status,
              creditLimit: ownedBusinesses.creditLimit,
            })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.ownerId, ctx.userId))
            .limit(1)
        : [undefined];

      // 2. Si no se encontró por userId directo, buscar por el email del usuario de la sesión
      if (!biz && ctx.user?.email) {
        const [coreUser] = await ctx.coreDb
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, ctx.user.email))
          .limit(1);

        if (coreUser?.id) {
          const [found] = await ctx.coreDb
            .select({
              id: ownedBusinesses.id,
              name: ownedBusinesses.name,
              category: ownedBusinesses.category,
              bunzBalance: ownedBusinesses.bunzBalance,
              package: ownedBusinesses.package,
              rewardPercentage: ownedBusinesses.rewardPercentage,
              status: ownedBusinesses.status,
              creditLimit: ownedBusinesses.creditLimit,
            })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.ownerId, coreUser.id))
            .limit(1);
          if (found) biz = found;
        }
      }

      // Si no tiene negocio asociado por userId directo, fallback a primera empresa o defaults seguros
      let firstBiz: typeof biz | undefined = undefined;
      if (!biz) {
        const [foundFirst] = await ctx.coreDb
          .select({
            id: ownedBusinesses.id,
            name: ownedBusinesses.name,
            category: ownedBusinesses.category,
            bunzBalance: ownedBusinesses.bunzBalance,
            package: ownedBusinesses.package,
            rewardPercentage: ownedBusinesses.rewardPercentage,
            status: ownedBusinesses.status,
            creditLimit: ownedBusinesses.creditLimit,
          })
          .from(ownedBusinesses)
          .limit(1);
        firstBiz = foundFirst;
      }

      const targetBiz = biz || firstBiz;

      let totalBunzMinted = 0;
      if (targetBiz?.id) {
        // Calcular total de Bunz minteados/otorgados desde las transacciones del negocio
        try {
          const [txAgg] = await ctx.coreDb
            .select({
              total: sql<number>`COALESCE(SUM(${transactions.bunzMinted}), 0)::int`,
            })
            .from(transactions)
            .where(eq(transactions.businessId, targetBiz.id));
          totalBunzMinted = Number(txAgg?.total ?? 0);
        } catch (aggErr) {
          console.warn("[getAffiliateBunzInventory] Could not aggregate transactions:", aggErr);
        }
      }

      if (biz) {
        return {
          hasBusiness: true,
          businessId: biz.id,
          businessName: biz.name,
          category: biz.category,
          bunzBalance: biz.bunzBalance ?? 0,
          totalBunzMinted,
          package: biz.package || "Personalizado",
          rewardPercentage: biz.rewardPercentage ?? 10,
          status: biz.status,
          creditLimit: biz.creditLimit ?? 0,
        };
      }

      return {
        hasBusiness: Boolean(firstBiz),
        businessId: firstBiz?.id || null,
        businessName: firstBiz?.name || "Mi Negocio",
        category: firstBiz?.category || "Comercio",
        bunzBalance: firstBiz?.bunzBalance ?? 0,
        totalBunzMinted,
        package: firstBiz?.package || "Personalizado",
        rewardPercentage: firstBiz?.rewardPercentage ?? 10,
        status: firstBiz?.status || "APPROVED",
        creditLimit: firstBiz?.creditLimit ?? 0,
      };
    } catch (e: any) {
      console.error("[getAffiliateBunzInventory] Error:", e);
      return {
        hasBusiness: false,
        businessId: null,
        businessName: "Mi Negocio",
        category: "Comercio",
        bunzBalance: 0,
        totalBunzMinted: 0,
        package: "Sin paquete",
        rewardPercentage: 10,
        status: "APPROVED",
        creditLimit: 0,
      };
    }
  }),

  getTreasuryWelcomeStatus: godAdminProcedure.query(async ({ ctx }) => {
    const allRows = await ctx.coreDb
      .select()
      .from(treasury)
      .orderBy(desc(treasury.createdAt));

    let grossWelcomeDebt = 0;
    let settledWelcomeDebt = 0;
    let grossTreasurySurplus = 0;
    let surplusUsedForSettlements = 0;
    let welcomeBonusesCount = 0;

    for (const row of allRows) {
      const amt = Number(row.amount || 0);
      if (row.type === "welcome_split_debt") {
        grossWelcomeDebt += Math.abs(amt);
        welcomeBonusesCount += 1;
      } else if (row.type === "welcome_debt_settlement") {
        settledWelcomeDebt += Math.max(0, amt);
      } else if (row.type === "fee_used_for_welcome_settlement") {
        surplusUsedForSettlements += Math.abs(amt);
      } else if (amt > 0) {
        grossTreasurySurplus += amt;
      }
    }

    const netOutstandingDebt = Math.max(0, grossWelcomeDebt - settledWelcomeDebt);
    const netNegativeBalance = -netOutstandingDebt;
    const availableSurplusForSettlement = Math.max(0, grossTreasurySurplus - surplusUsedForSettlements);

    // Tope mensual dinámico por afiliado + consumo del mes (tramo afiliado en ledger)
    const [capSetting] = await ctx.coreDb
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "welcome_bonus_monthly_cap"))
      .limit(1);
    let capConfig: { default: number; overrides: Record<string, number> } = { default: 200, overrides: {} };
    if (capSetting?.value) {
      try {
        const parsed = JSON.parse(capSetting.value);
        capConfig = {
          default: Math.max(0, Number(parsed.default) || 200),
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        };
      } catch {
        // keep defaults
      }
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const welcomeLedgerRows = await ctx.coreDb
      .select({ payerSubjectId: ledgerEntries.payerSubjectId, amount: ledgerEntries.amount })
      .from(ledgerEntries)
      .where(
        and(
          sql`"idempotencyKey" LIKE 'welcome_aff_%'`,
          sql`"createdAt" >= ${monthStart.toISOString()}`
        )
      );
    const usageByBiz: Record<string, number> = {};
    for (const r of welcomeLedgerRows) {
      usageByBiz[r.payerSubjectId] = (usageByBiz[r.payerSubjectId] || 0) + Math.max(0, Number(r.amount) || 0);
    }
    const businessList = await ctx.coreDb
      .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
      .from(ownedBusinesses);
    const nameById = new Map(businessList.map((b) => [b.id, b.name]));
    const perBusinessMonthlyUsage = Object.entries(usageByBiz)
      .map(([businessId, used]) => ({
        businessId,
        businessName: nameById.get(businessId) || businessId.slice(0, 8),
        used,
        cap: capConfig.overrides[businessId] ?? capConfig.default,
      }))
      .sort((a, b) => b.used - a.used)
      .slice(0, 15);

    return {
      netNegativeBalance,
      netOutstandingDebt,
      grossWelcomeDebt,
      settledWelcomeDebt,
      welcomeBonusesCount,
      totalFeeIncome: grossTreasurySurplus,
      availableSurplusForSettlement,
      recentEntries: allRows
        .filter((r) => r.type === "welcome_split_debt" || r.type === "welcome_debt_settlement")
        .slice(0, 10),
      capConfig,
      perBusinessMonthlyUsage,
    };
  }),

  settleTreasuryWelcomeDebt: godAdminProcedure
    .input(
      z.object({
        amountToSettle: z.number().min(1).optional(),
        mode: z.enum(["FROM_AVAILABLE_FEES", "FULL_BALANCE_RESET"]).default("FROM_AVAILABLE_FEES"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allRows = await ctx.coreDb.select().from(treasury);
      let grossWelcomeDebt = 0;
      let settledWelcomeDebt = 0;
      let grossTreasurySurplus = 0;
      let surplusUsedForSettlements = 0;

      for (const row of allRows) {
        const amt = Number(row.amount || 0);
        if (row.type === "welcome_split_debt") grossWelcomeDebt += Math.abs(amt);
        else if (row.type === "welcome_debt_settlement") settledWelcomeDebt += Math.max(0, amt);
        else if (row.type === "fee_used_for_welcome_settlement") surplusUsedForSettlements += Math.abs(amt);
        else if (amt > 0) grossTreasurySurplus += amt;
      }

      const netOutstandingDebt = Math.max(0, grossWelcomeDebt - settledWelcomeDebt);
      const availableSurplusForSettlement = Math.max(0, grossTreasurySurplus - surplusUsedForSettlements);

      if (netOutstandingDebt <= 0) {
        return {
          success: true,
          settledAmount: 0,
          remainingDebt: 0,
          message: "La Tesorería ya está 100% al corriente.",
        };
      }

      let targetSettle = input.amountToSettle
        ? Math.min(input.amountToSettle, netOutstandingDebt)
        : netOutstandingDebt;

      if (input.mode === "FROM_AVAILABLE_FEES") {
        if (availableSurplusForSettlement <= 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Aún no hay suficientes Bunz acumulados por comisiones en Tesorería. Puedes elegir Respaldo Directo de Reserva Admin.",
          });
        }
        targetSettle = Math.min(targetSettle, availableSurplusForSettlement);
      }

      await ctx.coreDb.insert(treasury).values({
        concept: `Liquidación Manual de Deuda por Bonos de Bienvenida (${
          input.mode === "FROM_AVAILABLE_FEES" ? "Con Comisiones Acumuladas" : "Ajuste de Reserva God Admin"
        })`,
        amount: targetSettle,
        type: "welcome_debt_settlement",
        referenceId: String(ctx.userId || "god_admin"),
        notes: JSON.stringify({
          settledBy: ctx.userId,
          mode: input.mode,
          previousDebt: netOutstandingDebt,
          settledAmount: targetSettle,
          remainingDebt: netOutstandingDebt - targetSettle,
          timestamp: new Date().toISOString(),
        }),
      });

      if (input.mode === "FROM_AVAILABLE_FEES") {
        await ctx.coreDb.insert(treasury).values({
          concept: "Aplicación de Comisiones de Tesorería para Amortizar Bonos de Bienvenida",
          amount: -targetSettle,
          type: "fee_used_for_welcome_settlement",
          referenceId: String(ctx.userId || "god_admin"),
          notes: `Compensación manual autorizada desde Admin Web (${ctx.userId})`,
        });
      }

      await ctx.coreDb.insert(auditEntries).values({
        userId: String(ctx.userId || "god_admin"),
        action: "TREASURY_WELCOME_DEBT_SETTLEMENT",
        resource: "treasury",
        resourceId: "sys_rabbitty_treasury",
        details: JSON.stringify({
          mode: input.mode,
          settledAmount: targetSettle,
          remainingDebt: netOutstandingDebt - targetSettle,
        }),
      });

      return {
        success: true,
        settledAmount: targetSettle,
        remainingDebt: netOutstandingDebt - targetSettle,
      };
    }),

  // ── Readiness del negocio afiliado: checklist REAL con accionables y niveles ──
  getReadiness: protectedProcedure.query(async ({ ctx }) => {
    const branchId = await resolveBranchId(ctx, ctx.branchId);
    const [branchRow] = await ctx.restaurantDb
      .select({ restaurantId: branches.restaurantId, address: branches.address, name: branches.name })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    const restaurantId = branchRow?.restaurantId ?? "";
    const [rest] = restaurantId
      ? await ctx.restaurantDb
          .select({ name: restaurants.name, phone: restaurants.phone, logoUrl: restaurants.logoUrl })
          .from(restaurants)
          .where(eq(restaurants.id, restaurantId))
          .limit(1)
      : [];
    const [biz] = await ctx.coreDb
      .select({ name: ownedBusinesses.name, category: ownedBusinesses.category, rewardPercentage: ownedBusinesses.rewardPercentage, slug: ownedBusinesses.slug, logoUrl: ownedBusinesses.logoUrl, description: ownedBusinesses.description, verificationData: ownedBusinesses.verificationData })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, sql`SELECT "businessId" FROM restaurants WHERE id = ${restaurantId}`))
      .limit(1);

    const catRows = await ctx.restaurantDb
      .select({ catCount: sql<number>`COUNT(*)::int` })
      .from(menuCategories)
      .where(eq(menuCategories.branchId, branchId));
    const catCount = Number(catRows[0]?.catCount ?? 0);
    const items = await ctx.restaurantDb
      .select({ id: menuItems.id, name: menuItems.name, imageUrl: menuItems.imageUrl, isActive: menuItems.isActive })
      .from(menuItems)
      .where(eq(menuItems.branchId, branchId));
    const liveItems = items.filter((i) => i.isActive);
    const itemsWithPhoto = liveItems.filter((i) => (i.imageUrl || "").trim().length > 0);

    const has = (v?: string | null) => Boolean((v || "").trim());
    const pct = Math.round(Number(biz?.rewardPercentage ?? 10));

    type Item = { id: string; label: string; done: boolean; href: string; level: "min" | "top"; cta: string };
    const all: Item[] = [
      { id: "name", label: "Nombre del negocio", done: has(rest?.name || biz?.name), href: "/settings", level: "min", cta: "Completar nombre" },
      { id: "phone", label: "Teléfono de contacto", done: has(rest?.phone), href: "/settings", level: "min", cta: "Agregar teléfono" },
      { id: "address", label: "Dirección física", done: has(branchRow?.address), href: "/settings", level: "min", cta: "Agregar dirección" },
      { id: "reward", label: `% de recompensa configurado`, done: pct > 0, href: "/settings", level: "min", cta: "Configurar %" },
      { id: "category", label: "Categoría / nicho de mercado", done: has(biz?.category), href: "/settings", level: "min", cta: "Elegir nicho" },
      { id: "categories", label: "Categorías de menú creadas", done: catCount > 0, href: "/menu", level: "min", cta: "Crear categorías" },
      { id: "items3", label: "Al menos 3 platillos/productos", done: liveItems.length >= 3, href: "/menu", level: "min", cta: "Cargar menú" },
      { id: "description", label: "Descripción del negocio", done: has(biz?.description), href: "/settings", level: "top", cta: "Escribir descripción" },
      { id: "logo", label: "Logo del negocio", done: has(rest?.logoUrl || biz?.logoUrl), href: "/settings", level: "top", cta: "Subir logo" },
      { id: "photos", label: `Fotos en platillos (${itemsWithPhoto.length}/${liveItems.length || 0}${liveItems.length ? `, mínimo 3` : ""})`, done: liveItems.length > 0 && itemsWithPhoto.length >= Math.min(3, liveItems.length) && itemsWithPhoto.length / liveItems.length >= 0.7, href: "/menu", level: "top", cta: "Subir fotos" },
      { id: "hours", label: "Horario y días de atención", done: Boolean(biz?.verificationData && JSON.stringify(biz.verificationData).includes("activeDays")), href: "/settings", level: "top", cta: "Configurar horario" },
      { id: "website", label: "Sitio web propio o Landing Rabbitty", done: false, href: "https://www.rabbitty.me", level: "top", cta: "Reclamar landing" },
    ];

    const minItems = all.filter((i) => i.level === "min");
    const topItems = all.filter((i) => i.level === "top");
    const minDone = minItems.filter((i) => i.done).length;
    const topDone = all.filter((i) => i.done).length;
    const percent = Math.round((topDone / all.length) * 100);
    const minComplete = minDone === minItems.length;

    return {
      businessName: rest?.name || biz?.name || branchRow?.name || "Mi Negocio",
      slug: biz?.slug ?? null,
      percent,
      minComplete,
      min: { done: minDone, total: minItems.length, items: minItems },
      top: { done: topDone, total: all.length, items: all },
      faltantes: all.filter((i) => !i.done),
    };
  }),

  getWelcomeCapSettings: godAdminProcedure.query(async ({ ctx }) => {
    const [capSetting] = await ctx.coreDb
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "welcome_bonus_monthly_cap"))
      .limit(1);

    let capConfig: { default: number; overrides: Record<string, number> } = {
      default: 200,
      overrides: {},
    };
    if (capSetting?.value) {
      try {
        const parsed = JSON.parse(capSetting.value);
        capConfig = {
          default: Math.max(0, Number(parsed.default) || 200),
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        };
      } catch {
        // keep defaults
      }
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const welcomeRows = await ctx.coreDb
      .select({
        payerSubjectId: ledgerEntries.payerSubjectId,
        amount: ledgerEntries.amount,
      })
      .from(ledgerEntries)
      .where(
        and(
          sql`"idempotencyKey" LIKE 'welcome_aff_%'`,
          sql`"createdAt" >= ${monthStart.toISOString()}`
        )
      );

    const usage: Record<string, number> = {};
    for (const r of welcomeRows) {
      usage[r.payerSubjectId] = (usage[r.payerSubjectId] || 0) + Math.max(0, Number(r.amount) || 0);
    }

    const businessList = await ctx.coreDb
      .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, status: ownedBusinesses.status })
      .from(ownedBusinesses);
    const nameById = new Map(businessList.map((b) => [b.id, b.name]));

    return {
      capConfig,
      usage: Object.entries(usage)
        .map(([businessId, used]) => ({
          businessId,
          businessName: nameById.get(businessId) || businessId.slice(0, 8),
          used,
          cap: capConfig.overrides[businessId] ?? capConfig.default,
        }))
        .sort((a, b) => b.used - a.used)
        .slice(0, 15),
    };
  }),

  setWelcomeCapSettings: godAdminProcedure
    .input(
      z.object({
        default: z.number().min(0).max(100000),
        overrides: z.record(z.string(), z.number().min(0).max(100000)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clean = {
        default: Math.round(input.default),
        overrides: {} as Record<string, number>,
      };
      for (const [bizId, cap] of Object.entries(input.overrides || {})) {
        const n = Math.round(cap);
        if (bizId && n > 0) clean.overrides[bizId] = n;
      }
      const [existing] = await ctx.coreDb
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "welcome_bonus_monthly_cap"))
        .limit(1);
      if (existing) {
        await ctx.coreDb
          .update(systemSettings)
          .set({ value: JSON.stringify(clean), updatedAt: new Date() })
          .where(eq(systemSettings.key, "welcome_bonus_monthly_cap"));
      } else {
        await ctx.coreDb
          .insert(systemSettings)
          .values({ key: "welcome_bonus_monthly_cap", value: JSON.stringify(clean) });
      }
      await ctx.coreDb.insert(auditEntries).values({
        userId: String(ctx.userId || "god_admin"),
        action: "WELCOME_BONUS_CAP_UPDATED",
        resource: "systemSettings",
        resourceId: "welcome_bonus_monthly_cap",
        details: JSON.stringify(clean),
      });
      return { success: true, capConfig: clean };
    }),
});
