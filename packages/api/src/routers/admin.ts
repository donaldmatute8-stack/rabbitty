import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { restaurants, branches, orders, tables } from "@rabbitty/database-restaurant/schema";
import { referrals } from "@rabbitty/database-core";
import { miniappClient } from "../services/miniapp-client";



import * as cheerio from "cheerio";

export const adminRouter = router({
  getRestaurants: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.restaurantDb.select().from(restaurants);
    return result;
  }),

  updateRestaurant: protectedProcedure
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
      await ctx.restaurantDb.update(restaurants).set(input).where(eq(restaurants.id, input.id));

      // Auto-sync to miniapp
      try {
        const [updated] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, input.id));
        if (updated?.businessId) {
          await miniappClient.createBusiness({
            name: updated.name,
            category: "Restaurante",
            address: "",
            rewardPercentage: updated.defaultRewardRate ?? 10,
            telegramId: updated.businessId,
          });
        }
      } catch {
        // Non-critical — restaurant updated locally
      }

      return { success: true };
    }),

  verifyBusiness: protectedProcedure
    .input(z.object({ businessId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.businessId, input.businessId));
      if (restaurant) {
        await ctx.restaurantDb.update(restaurants).set({ isActive: true }).where(eq(restaurants.id, restaurant.id));
        return { success: true, restaurantId: restaurant.id };
      }
      return { success: false };
    }),

  createCategory: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.restaurantDb.insert(dbSchema.menuCategories).values({
        branchId: input.branchId,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      }).returning();
      return category;
    }),

  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(dbSchema.menuCategories).set(input).where(eq(dbSchema.menuCategories.id, input.id));
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(dbSchema.menuCategories).where(eq(dbSchema.menuCategories.id, input.id));
      return { success: true };
    }),

  createMenuItem: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        branchId: z.string(),
        name: z.string(),
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
        branchId: input.branchId,
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

  updateMenuItem: protectedProcedure
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
      await ctx.restaurantDb.update(dbSchema.menuItems).set(input).where(eq(dbSchema.menuItems.id, input.id));
      return { success: true };
    }),

  deleteMenuItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
      const result = await ctx.restaurantDb.select().from(orders).where(
        and(
          eq(orders.branchId, ctx.branchId),
          sql`${orders.createdAt} BETWEEN ${input.startDate} AND ${input.endDate}`
        )
      );
      const totalSales = result.reduce((sum, order) => sum + order.total, 0);
      const totalOrders = result.length;
      return { totalSales, totalOrders };
    }),

  importUberEatsMenu: protectedProcedure
    .input(z.object({ branchId: z.string(), url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
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
          $('ul, [data-testid="rich-text"]').each((i, el) => {
            const heading = $(el).prev('h2').text().trim() || $(el).find('h2').first().text().trim();
            if (heading && heading.length < 40 && !heading.includes("Uber")) {
              const items: any[] = [];
              
              // Buscar elementos que parezcan productos (li o divs con rol listitem)
              $(el).find('li, [role="listitem"]').each((j, itemEl) => {
                const textContent = $(itemEl).text();
                // Buscar precios con regex
                const priceMatch = textContent.match(/\$?\s*(\d+[.,]\d{2})/);
                const price = priceMatch && priceMatch[1] ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
                
                // Buscar nombres (generalmente están en un span o div prominente al inicio)
                const possibleNames = $(itemEl).find('span, div').filter((k, e) => {
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
              branchId: input.branchId,
              name: category.name,
              sortOrder: sortOrder++,
            }).returning();

            if (!cat) throw new Error("Failed to create category");

            if (category.items.length > 0) {
              const itemsToInsert = category.items.map((item, index) => ({
                categoryId: cat.id,
                branchId: input.branchId,
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
            branchId: input.branchId,
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
                branchId: input.branchId,
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
    return await ctx.restaurantDb.select().from(branches);
  }),

  getCrossStoreKpis: protectedProcedure.query(async ({ ctx }) => {
    const allBranches = await ctx.restaurantDb.select().from(branches);

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
