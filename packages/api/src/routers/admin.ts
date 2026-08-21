import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure, adminOnlyProcedure, platformOnlyProcedure, resolveBranchId } from "../trpc";
import { TRPCError } from "@trpc/server";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { restaurants, branches, orders, tables, staff } from "@rabbitty/database-restaurant/schema";
import { referrals, users, levels, ownedBusinesses } from "@rabbitty/database-core";
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

  getPendingBusinesses: protectedProcedure.query(async ({ ctx }) => {
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

  approveOwnedBusiness: platformOnlyProcedure
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

  getRestaurants: platformOnlyProcedure.query(async ({ ctx }) => {
    const result = await ctx.restaurantDb.select().from(restaurants);
    return result;
  }),

  updateRestaurant: adminOnlyProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        currency: z.string().optional(),
        taxRate: z.number().optional(),
        timezone: z.string().optional(),
        defaultRewardRate: z.number().optional(),
        acceptsBunz: z.boolean().optional(),
        happyHourStart: z.string().optional().nullable(),
        happyHourEnd: z.string().optional().nullable(),
        happyHourRewardRate: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Soft-guard de ownership (IDOR): si el usuario tiene personal vinculado,
      // solo puede editar restaurantes de las sucursales de su staff. Si NO tiene
      // staff vinculado (p.ej. seed o setup inicial), mantiene comportamiento legacy.
      const staffRows = await ctx.restaurantDb
        .select({ branchId: staff.branchId })
        .from(staff)
        .where(eq(staff.userId, ctx.userId));
      const branchIds = staffRows.map((s) => s.branchId).filter(Boolean);
      if (branchIds.length > 0) {
        const branchRows = await ctx.restaurantDb
          .select({ restaurantId: branches.restaurantId })
          .from(branches)
          .where(inArray(branches.id, branchIds));
        const allowedIds = branchRows.map((b) => b.restaurantId).filter(Boolean);
        if (allowedIds.length > 0 && !allowedIds.includes(input.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permisos para modificar este restaurante." });
        }
      }

      await ctx.restaurantDb.update(restaurants).set(input).where(eq(restaurants.id, input.id));

      // Auto-sync to miniapp
      try {
        const [updated] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, input.id));
        if (updated?.businessId) {
          // rewardPercentage en la miniapp es percent entero. Normaliza valores legacy < 1.
          const rate = typeof updated.defaultRewardRate === "number" && updated.defaultRewardRate > 0 && updated.defaultRewardRate < 1
            ? Math.round(updated.defaultRewardRate * 100)
            : updated.defaultRewardRate;
          await miniappClient.createBusiness({
            name: updated.name,
            category: "Restaurante",
            address: "",
            rewardPercentage: rate ?? 10,
            telegramId: updated.businessId,
          });
        }
      } catch {
        // Non-critical — restaurant updated locally
      }

      return { success: true };
    }),

  verifyBusiness: platformOnlyProcedure
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
        branchId: resolveBranchId(ctx, undefined),
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
        .where(and(eq(dbSchema.menuCategories.id, input.id), eq(dbSchema.menuCategories.branchId, resolveBranchId(ctx, undefined))));
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
        .where(and(eq(dbSchema.menuCategories.id, input.id), eq(dbSchema.menuCategories.branchId, resolveBranchId(ctx, undefined))));
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
        branchId: resolveBranchId(ctx, undefined),
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
        .where(and(eq(dbSchema.menuItems.id, input.id), eq(dbSchema.menuItems.branchId, resolveBranchId(ctx, undefined))));
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
        .where(and(eq(dbSchema.menuItems.id, input.id), eq(dbSchema.menuItems.branchId, resolveBranchId(ctx, undefined))));
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
          sql`${orders.createdAt} >= ${start}`,
          sql`${orders.createdAt} < ${end}`
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
        const branchId = resolveBranchId(ctx, input.branchId);
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
      return await ctx.restaurantDb.select().from(branches).where(eq(branches.id, ctx.staffBranchId));
    }
    return await ctx.restaurantDb.select().from(branches);
  }),

  getCrossStoreKpis: protectedProcedure.query(async ({ ctx }) => {
    let allBranches = await ctx.restaurantDb.select().from(branches);
    if (ctx.staffRole && ctx.staffBranchId) {
      allBranches = allBranches.filter(b => b.id === ctx.staffBranchId);
    }

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
    const allUsers = await ctx.coreDb.select().from(users);
    const allLevels = await ctx.coreDb.select().from(levels);
    const totalBunzEarned = allUsers.reduce((s, u) => s + (u.totalBunzEarned ?? 0), 0);
    const totalSpent = allUsers.reduce((s, u) => s + (u.totalBunzSpent ?? 0), 0);
    const totalHops = allUsers.reduce((s, u) => s + (u.hops ?? 0), 0);
    const topUsers = allUsers.sort((a, b) => (b.hops ?? 0) - (a.hops ?? 0)).slice(0, 10);
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
});
