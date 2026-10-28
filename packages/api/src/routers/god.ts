import { z } from "zod";
import crypto from "crypto";
import { eq, sql, desc, gte } from "drizzle-orm";
import { router, godAdminProcedure } from "../trpc";
import {
  users,
  ownedBusinesses,
  transactions,
  levels,
  hatTricks,
} from "@rabbitty/database-core";
import { ledgerEntries } from "@rabbitty/database-restaurant/schema";
import {
  restaurants,
  branches,
  menuCategories,
  menuItems,
  tables as tablesTable,
  orders,
} from "@rabbitty/database-restaurant/schema";
import { TRPCError } from "@trpc/server";

/**
 * ── GOD ROUTER: operaciones exclusivas del God Admin (requiere identidad + 2FA) ──
 * Tenants (lista + crear afiliado prueba), Ecosistema, Economía/Ledger,
 * Scaling y Gamificación. Portado 1:1 del AdminPanel móvil a la web.
 */
export const godRouter = router({
  // ── Perfil de la sesión actual para el shell: ¿soy God? ¿2FA? ¿impersonando? ──
  getGodProfile: godAdminProcedure.query(async ({ ctx }) => {
    const [branchRow] = await ctx.restaurantDb
      .select({ name: branches.name, restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, ctx.branchId))
      .limit(1);
    return {
      branchId: ctx.branchId,
      branchName: branchRow?.name ?? null,
      impersonating: ctx.impersonating ?? null,
      twoFaVerified: Boolean(ctx.god2faVerified),
    };
  }),

  // ── Tenants: todos los negocios con owner y sucursal activa (para Entrar como) ──
  listTenants: godAdminProcedure.query(async ({ ctx }) => {
    const bizList = await ctx.coreDb
      .select({
        id: ownedBusinesses.id,
        name: ownedBusinesses.name,
        category: ownedBusinesses.category,
        status: ownedBusinesses.status,
        slug: ownedBusinesses.slug,
        package: ownedBusinesses.package,
        creditLimit: ownedBusinesses.creditLimit,
        creditUsed: ownedBusinesses.creditUsed,
        bunzBalance: ownedBusinesses.bunzBalance,
        createdAt: ownedBusinesses.createdAt,
        ownerName: users.firstName,
        ownerUsername: users.username,
        ownerEmail: users.email,
      })
      .from(ownedBusinesses)
      .leftJoin(users, eq(ownedBusinesses.ownerId, users.id))
      .orderBy(desc(ownedBusinesses.createdAt))
      .limit(100);

    const restaurantRows = await ctx.restaurantDb
      .select({ id: restaurants.id, businessId: restaurants.businessId, name: restaurants.name })
      .from(restaurants);
    const branchRows = await ctx.restaurantDb
      .select({ id: branches.id, restaurantId: branches.restaurantId, name: branches.name, isActive: branches.isActive })
      .from(branches);

    const restByBiz = new Map(restaurantRows.map((r) => [r.businessId, r]));
    const branchByRest = new Map<string, { id: string; name: string; isActive: boolean }[]>();
    for (const b of branchRows) {
      const list = branchByRest.get(b.restaurantId) || [];
      list.push({ id: b.id, name: b.name, isActive: b.isActive });
      branchByRest.set(b.restaurantId, list);
    }

    return bizList.map((b) => {
      const rest = restByBiz.get(b.id);
      const activeBranches = (rest ? branchByRest.get(rest.id) || [] : []).filter((x) => x.isActive);
      return {
        ...b,
        restaurantName: rest?.name ?? null,
        branchId: activeBranches[0]?.id ?? null,
        branchName: activeBranches[0]?.name ?? null,
        branchCount: activeBranches.length,
        canImpersonate: Boolean(activeBranches[0]?.id),
      };
    });
  }),

  // ── Crear Afiliado Prueba (1 clic): usuario + negocio + restaurante + sucursal + menú seed ──
  createTestAffiliate: godAdminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        category: z.string().min(2).max(40).default("Cafetería"),
        rewardPercentage: z.number().min(1).max(50).default(12),
        package: z.enum(["STARTER", "GROWTH", "PRO"]).default("STARTER"),
        creditLimit: z.number().min(0).max(100000).default(500),
        ownerEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = `test-${input.name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
      const ownerEmail = (input.ownerEmail || `${slug}@test.rabbitty.me`).toLowerCase();

      // 1. Usuario core de prueba
      const [testOwner] = await ctx.coreDb
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email: ownerEmail,
          firstName: input.name.slice(0, 30),
          lastName: "(Prueba)",
          username: slug.slice(0, 20),
          role: "AFFILIATE",
        })
        .returning({ id: users.id, email: users.email });
      if (!testOwner) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear el usuario de prueba" });

      // 2. Negocio APPROVED
      const [biz] = await ctx.coreDb
        .insert(ownedBusinesses)
        .values({
          name: input.name,
          slug,
          category: input.category,
          status: "APPROVED",
          ownerId: testOwner.id,
          package: input.package,
          creditLimit: input.creditLimit,
          creditUsed: 0,
          bunzBalance: 0,
          rewardPercentage: input.rewardPercentage,
          description: `Afiliado de prueba creado por God Admin`,
          address: `${input.name} (sucursal prueba)`,
          lat: 0,
          lng: 0,
        })
        .returning({ id: ownedBusinesses.id, name: ownedBusinesses.name });
      if (!biz) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear el negocio" });

      // 3. Restaurante + sucursal operativa
      const [rest] = await ctx.restaurantDb
        .insert(restaurants)
        .values({
          name: input.name,
          businessId: biz.id,
          slug,
        })
        .returning({ id: restaurants.id });
      if (!rest) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear el restaurante" });

      const [branch] = await ctx.restaurantDb
        .insert(branches)
        .values({
          name: `Sucursal ${input.name}`,
          restaurantId: rest.id,
          address: `${input.name} (sucursal prueba)`,
          lat: 0,
          lng: 0,
          isActive: true,
        })
        .returning({ id: branches.id, name: branches.name });
      if (!branch) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la sucursal" });

      // 4. Menú seed mínimo (2 categorías, 4 platillos) para que el POS funcione
      const cats = await ctx.restaurantDb
        .insert(menuCategories)
        .values([
          { branchId: branch.id, name: "Bebidas", sortOrder: 1 },
          { branchId: branch.id, name: "Comida", sortOrder: 2 },
        ])
        .returning({ id: menuCategories.id, name: menuCategories.name });
      const drinkCat = cats.find((c) => c.name === "Bebidas");
      const foodCat = cats.find((c) => c.name === "Comida");
      if (drinkCat && foodCat) {
        await ctx.restaurantDb.insert(menuItems).values([
          { branchId: branch.id, categoryId: drinkCat.id, name: "Café Americano", price: 55 },
          { branchId: branch.id, categoryId: drinkCat.id, name: "Capuccino", price: 65 },
          { branchId: branch.id, categoryId: foodCat.id, name: "Panini", price: 95 },
          { branchId: branch.id, categoryId: foodCat.id, name: "Ensalada", price: 85 },
        ]);
      }

      // 5. 4 mesas con QR listo
      await ctx.restaurantDb.insert(tablesTable).values(
        [1, 2, 3, 4].map((n) => ({
          branchId: branch.id,
          number: n,
          capacity: 4,
        }))
      );

      return { businessId: biz.id, businessName: biz.name, ownerEmail, branchId: branch.id, branchName: branch.name, slug };
    }),

  // ── Ecosistema: métricas de investor (port del AdminPanel móvil) ──
  getEcosystemMetrics: godAdminProcedure.query(async ({ ctx }) => {
    const [bizStats] = await ctx.coreDb
      .select({
        totalBusinesses: sql<number>`COUNT(*)`,
        activeBusinesses: sql<number>`COUNT(*) FILTER (WHERE status = 'ACTIVE' OR status = 'APPROVED')`,
        pendingBusinesses: sql<number>`COUNT(*) FILTER (WHERE status = 'PENDING' OR status = 'PENDING_VERIFICATION')`,
        totalCreditLimit: sql<number>`COALESCE(SUM(creditLimit), 0)`,
        totalCreditUsed: sql<number>`COALESCE(SUM(creditUsed), 0)`,
      })
      .from(ownedBusinesses);

    const [userStats] = await ctx.coreDb
      .select({
        totalUsers: sql<number>`COUNT(*)`,
        totalBunzEarned: sql<number>`COALESCE(SUM(totalBunzEarned), 0)`,
        totalBunzSpent: sql<number>`COALESCE(SUM(totalBunzSpent), 0)`,
      })
      .from(users);

    const [ledgerStats] = await ctx.coreDb
      .select({
        totalEarned: sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'EARN'), 0)`,
        countEarned: sql<number>`COUNT(*) FILTER (WHERE type = 'EARN')`,
        totalSpent: sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'SPEND'), 0)`,
        countSpent: sql<number>`COUNT(*) FILTER (WHERE type = 'SPEND')`,
        totalTransfers: sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'TRANSFER'), 0)`,
        countTransfers: sql<number>`COUNT(*) FILTER (WHERE type = 'TRANSFER')`,
      })
      .from(ledgerEntries);

    const businessesBreakdown = await ctx.coreDb
      .select({
        id: ownedBusinesses.id,
        name: ownedBusinesses.name,
        category: ownedBusinesses.category,
        status: ownedBusinesses.status,
        creditLimit: ownedBusinesses.creditLimit,
        creditUsed: ownedBusinesses.creditUsed,
        createdAt: ownedBusinesses.createdAt,
      })
      .from(ownedBusinesses)
      .orderBy(desc(ownedBusinesses.createdAt))
      .limit(50);

    const recentLedger = await ctx.coreDb
      .select({
        id: ledgerEntries.id,
        payer: ledgerEntries.payerSubjectId,
        payee: ledgerEntries.payeeSubjectId,
        amount: ledgerEntries.amount,
        type: ledgerEntries.type,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(15);

    const recentTxns = await ctx.coreDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions)
      .where(gte(transactions.createdAt, sql`NOW() - INTERVAL '30 days'`));

    return {
      businesses: {
        total: Number(bizStats?.totalBusinesses || 0),
        active: Number(bizStats?.activeBusinesses || 0),
        pending: Number(bizStats?.pendingBusinesses || 0),
        totalCreditLimit: Number(bizStats?.totalCreditLimit || 0),
        totalCreditUsed: Number(bizStats?.totalCreditUsed || 0),
      },
      rabbitters: {
        total: Number(userStats?.totalUsers || 0),
        totalBunzEarned: Number(userStats?.totalBunzEarned || 0),
        totalBunzSpent: Number(userStats?.totalBunzSpent || 0),
        circulatingSupply: Number(userStats?.totalBunzEarned || 0) - Number(userStats?.totalBunzSpent || 0),
      },
      ledger: {
        rewardsGiven: Number(ledgerStats?.totalEarned || 0),
        rewardsCount: Number(ledgerStats?.countEarned || 0),
        redemptionsSpent: Number(ledgerStats?.totalSpent || 0),
        redemptionsCount: Number(ledgerStats?.countSpent || 0),
        transfersP2P: Number(ledgerStats?.totalTransfers || 0),
        transfersCount: Number(ledgerStats?.countTransfers || 0),
      },
      monthlyTxns: Number(recentTxns[0]?.count || 0),
      businessesBreakdown,
      recentLedger,
    };
  }),

  // ── Economía: reconciliación cached balance vs ledger inmutable ──
  getLedgerReconciliation: godAdminProcedure
    .input(z.object({ discrepanciesOnly: z.boolean().default(false), limit: z.number().min(10).max(1000).default(200) }))
    .query(async ({ ctx, input }) => {
      const allUsers = await ctx.coreDb
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          totalBunzEarned: users.totalBunzEarned,
          totalBunzSpent: users.totalBunzSpent,
        })
        .from(users)
        .limit(input.limit);

      const ledgerCredits = await ctx.coreDb
        .select({ subjectId: ledgerEntries.payeeSubjectId, total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(ledgerEntries)
        .groupBy(ledgerEntries.payeeSubjectId);
      const ledgerDebits = await ctx.coreDb
        .select({ subjectId: ledgerEntries.payerSubjectId, total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(ledgerEntries)
        .groupBy(ledgerEntries.payerSubjectId);

      const creditMap = new Map(ledgerCredits.map((r) => [r.subjectId, Number(r.total)]));
      const debitMap = new Map(ledgerDebits.map((r) => [r.subjectId, Number(r.total)]));

      const reports: {
        userId: string; username: string; cachedBalance: number; ledgerNet: number; discrepancy: number; isBalanced: boolean;
      }[] = [];
      let totalCached = 0, totalLedger = 0, discrepant = 0;

      for (const u of allUsers) {
        const cachedBalance = (u.totalBunzEarned || 0) - (u.totalBunzSpent || 0);
        const ledgerNet = (creditMap.get(`usr_${u.id}`) || 0) - (debitMap.get(`usr_${u.id}`) || 0);
        const diff = cachedBalance - ledgerNet;
        const isBalanced = diff === 0;
        if (!isBalanced) discrepant += 1;
        totalCached += cachedBalance;
        totalLedger += ledgerNet;
        if (!input.discrepanciesOnly || !isBalanced) {
          reports.push({
            userId: u.id,
            username: u.username || u.firstName || "Sin nombre",
            cachedBalance,
            ledgerNet,
            discrepancy: diff,
            isBalanced,
          });
        }
      }

      return {
        timestamp: new Date().toISOString(),
        totalUsersChecked: allUsers.length,
        balancedUsers: allUsers.length - discrepant,
        discrepantUsers: discrepant,
        totalCachedCirculation: totalCached,
        totalLedgerCirculation: totalLedger,
        systemDifference: totalCached - totalLedger,
        status: discrepant === 0 ? ("HEALTHY" as const) : ("DEVIATION_DETECTED" as const),
        details: reports.slice(0, input.discrepanciesOnly ? reports.length : 50),
      };
    }),

  // ── Scaling: umbrales de infraestructura (port móvil) ──
  getScalingStatus: godAdminProcedure.query(async ({ ctx }) => {
    const THRESHOLDS = {
      users: { max: 5000, label: "Usuarios Registrados", icon: "👤" },
      businesses: { max: 100, label: "Negocios Activos", icon: "🏪" },
      monthlyTxns: { max: 50000, label: "Transacciones/Mes", icon: "💳" },
      monthlyOrders: { max: 25000, label: "Órdenes POS/Mes", icon: "📋" },
      dbSize: { max: 2048, label: "Base de Datos (MB)", icon: "🗄️" },
    };

    const [userCount] = await ctx.coreDb.select({ count: sql<number>`COUNT(*)` }).from(users);
    const [bizCount] = await ctx.coreDb.select({ count: sql<number>`COUNT(*)` }).from(ownedBusinesses);
    const [txnCount] = await ctx.coreDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions)
      .where(gte(transactions.createdAt, sql`NOW() - INTERVAL '30 days'`));
    const [dbSize] = await ctx.coreDb.execute(
      sql`SELECT pg_database_size(current_database())::int / (1024 * 1024) as size_mb`
    );
    const [orderCount] = await ctx.restaurantDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(gte(orders.createdAt, sql`NOW() - INTERVAL '30 days'`));

    const dbSizeMb = Number((dbSize as unknown as { rows?: { size_mb: number }[] })?.rows?.[0]?.size_mb ?? 0);
    const metrics = [
      { key: "users", ...THRESHOLDS.users, value: Number(userCount?.count || 0), pct: Math.min(100, (Number(userCount?.count || 0) / THRESHOLDS.users.max) * 100) },
      { key: "businesses", ...THRESHOLDS.businesses, value: Number(bizCount?.count || 0), pct: Math.min(100, (Number(bizCount?.count || 0) / THRESHOLDS.businesses.max) * 100) },
      { key: "monthlyTxns", ...THRESHOLDS.monthlyTxns, value: Number(txnCount?.count || 0), pct: Math.min(100, (Number(txnCount?.count || 0) / THRESHOLDS.monthlyTxns.max) * 100) },
      { key: "monthlyOrders", ...THRESHOLDS.monthlyOrders, value: Number(orderCount?.count || 0), pct: Math.min(100, (Number(orderCount?.count || 0) / THRESHOLDS.monthlyOrders.max) * 100) },
      { key: "dbSize", ...THRESHOLDS.dbSize, value: dbSizeMb, pct: Math.min(100, (dbSizeMb / THRESHOLDS.dbSize.max) * 100) },
    ];
    return { metrics, over80: metrics.filter((m) => m.pct >= 80).map((m) => m.label) };
  }),

  // ── Gamificación: trucos del sombrero + niveles ──
  getGamification: godAdminProcedure.query(async ({ ctx }) => {
    const allLevels = await ctx.coreDb.select().from(levels).orderBy(levels.requiredHops);
    const allTricks = await ctx.coreDb.select().from(hatTricks).orderBy(desc(hatTricks.createdAt));
    return { levels: allLevels, tricks: allTricks };
  }),

  createHatTrick: godAdminProcedure
    .input(
      z.object({
        title: z.string().min(2).max(80),
        description: z.string().min(2).max(300),
        rewardHops: z.number().min(0).max(10000),
        rewardBunz: z.number().min(0).max(10000),
        conditionType: z.enum(["TOTAL_VISITS", "TOTAL_SPENT", "TOTAL_BUNZ"]).default("TOTAL_VISITS"),
        conditionTarget: z.number().min(1).max(100000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [trick] = await ctx.coreDb
        .insert(hatTricks)
        .values({
          id: crypto.randomUUID(),
          title: input.title,
          description: input.description,
          rewardHops: input.rewardHops,
          rewardBunz: input.rewardBunz,
          conditionType: input.conditionType,
          conditionTarget: input.conditionTarget,
          isActive: true,
        })
        .returning();
      return { success: true, trick };
    }),

  updateLevel: godAdminProcedure
    .input(
      z.object({
        id: z.string(),
        bunzMultiplier: z.number().min(0.1).max(100),
        requiredHops: z.number().min(0).max(1000000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.coreDb
        .update(levels)
        .set({ bunzMultiplier: input.bunzMultiplier, requiredHops: input.requiredHops })
        .where(eq(levels.id, input.id));
      return { success: true };
    }),
});
