import { z } from "zod";
import crypto from "crypto";
import { and, eq, sql, desc, gte, inArray, lt } from "drizzle-orm";
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
  payments,
  paymentIntents,
} from "@rabbitty/database-restaurant/schema";
// Campañas viven en coreDb
import { affiliateCampaigns, campaignRedemptions } from "@rabbitty/database-core/schema";
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
          // Espejar el % del negocio desde el día 0: el POS cobra con
          // restaurants.defaultRewardRate (lookupRabbitter/payOrder leen de aquí).
          // Sin esto, cada tenant nace con business % ≠ restaurant %.
          defaultRewardRate: input.rewardPercentage,
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

  // ── Aprovisionamiento del plan "Analíticas Pro" por restaurante (God) ──
  listAnalyticsTenants: godAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.restaurantDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        currency: restaurants.currency,
        analyticsProEnabled: restaurants.analyticsProEnabled,
        showUsdTicket: restaurants.showUsdTicket,
        createdAt: restaurants.createdAt,
      })
      .from(restaurants)
      .orderBy(desc(restaurants.createdAt));

    // Branches por restaurante (para mostrar tamaño de flota)
    const branchCounts = await ctx.restaurantDb
      .select({ restaurantId: branches.restaurantId, count: sql<number>`COUNT(*)` })
      .from(branches)
      .groupBy(branches.restaurantId);
    const bcMap = new Map(branchCounts.map((r) => [r.restaurantId, Number(r.count)]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      currency: r.currency,
      branchCount: bcMap.get(r.id) ?? 0,
      analyticsProEnabled: Boolean(r.analyticsProEnabled),
      showUsdTicket: Boolean(r.showUsdTicket),
      createdAt: r.createdAt,
    }));
  }),

  /** Conceder/quitar el plan Analíticas Pro de un restaurante (sin importar facturación aún). */
  setAnalyticsPro: godAdminProcedure
    .input(z.object({ restaurantId: z.string(), enabled: z.boolean(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb
        .update(restaurants)
        .set({ analyticsProEnabled: input.enabled })
        .where(eq(restaurants.id, input.restaurantId));
      console.log(`[GOD_PROVISION] Analíticas Pro ${input.enabled ? "ACTIVADO" : "DESACTIVADO"} para ${input.restaurantId}${input.note ? ` — ${input.note}` : ""}`);
      return { success: true, restaurantId: input.restaurantId, enabled: input.enabled };
    }),

  // ── MÉTRICAS DE PAGO: ¿cómo pagan los clientes? (métodos, mix, funnel, tips) ──
  getPaymentMetrics: godAdminProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const window = sql`NOW() - (INTERVAL '1 day' * ${input.days})`;

      // Mix por método de pago (orders pagadas → payments COMPLETED)
      const byMethod = await ctx.restaurantDb
        .select({
          method: payments.method,
          count: sql<number>`COUNT(*)`,
          total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
          avg: sql<number>`COALESCE(AVG(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(and(eq(payments.status, "COMPLETED"), gte(payments.createdAt, window)))
        .groupBy(payments.method)
        .orderBy(desc(sql`COALESCE(SUM(${payments.amount}), 0)`));

      const totalAmount = Number(byMethod.reduce((s: number, r: { total: unknown }) => s + Number(r.total), 0));
      const totalCount = byMethod.reduce((s: number, r: { count: unknown }) => s + Number(r.count), 0);

      // Verificación de pago (humano vs webhook)
      const byVerification = await ctx.restaurantDb
        .select({
          verification: payments.verificationMethod,
          count: sql<number>`COUNT(*)`,
        })
        .from(payments)
        .where(and(eq(payments.status, "COMPLETED"), gte(payments.createdAt, window)))
        .groupBy(payments.verificationMethod);

      // Intents: funnel de conversión del cobro digital
      const intentFunnel = await ctx.restaurantDb
        .select({ status: paymentIntents.status, count: sql<number>`COUNT(*)` })
        .from(paymentIntents)
        .where(gte(paymentIntents.createdAt, window))
        .groupBy(paymentIntents.status)
        .orderBy(desc(sql`COUNT(*)`));
      const intentsByStatus = intentFunnel.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = Number(r.count);
        return acc;
      }, {});
      const intentsTotal = intentFunnel.reduce((s, r) => s + Number(r.count), 0);

      // Abandoned checkout: intents vivos pero ya expirados (nunca pagaron)
      const abandoned = await ctx.restaurantDb
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentIntents)
        .where(and(
          inArray(paymentIntents.status, ["PENDING_PAYMENT", "REQUIRES_ACTION"]),
          lt(paymentIntents.createdAt, sql`NOW() - INTERVAL '2 hours'`)
        ));

      // Propinas
      const [tipStats] = await ctx.restaurantDb
        .select({
          ordersWithTip: sql<number>`COUNT(*) FILTER (WHERE ${orders.tip} > 0)`,
          totalTip: sql<number>`COALESCE(SUM(${orders.tip}), 0)`,
        })
        .from(orders)
        .where(and(inArray(orders.status, ["COMPLETED", "PAID"]), gte(orders.createdAt, window)));

      // Mix por semana (últimas 12 semanas) para trend
      const weekly = await ctx.restaurantDb
        .select({
          week: sql<string>`to_char(date_trunc('week', ${payments.createdAt}), 'DD Mon')`,
          method: payments.method,
          total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(and(eq(payments.status, "COMPLETED"), gte(payments.createdAt, sql`NOW() - (INTERVAL '1 day' * 84)`)))
        .groupBy(sql`date_trunc('week', ${payments.createdAt})`, payments.method)
        .orderBy(sql`date_trunc('week', ${payments.createdAt})`);

      return {
        windowDays: input.days,
        byMethod: byMethod.map((r) => ({
          method: r.method,
          count: Number(r.count),
          total: Number(r.total),
          avg: Number(r.avg),
          share: totalAmount > 0 ? Math.round((Number(r.total) / totalAmount) * 1000) / 10 : 0,
        })),
        totalCount,
        totalAmount,
        byVerification: byVerification.map((r) => ({ verification: r.verification, count: Number(r.count) })),
        intents: {
          total: intentsTotal,
          byStatus: intentsByStatus,
          ...(() => {
            const s = intentsByStatus;
            const settled = (s["SUCCEEDED"] ?? 0) + (s["PROCESSING"] ?? 0);
            const failed = (s["EXPIRED"] ?? 0) + (s["CANCELLED"] ?? 0) + (s["FAILED"] ?? 0);
            const conversion = intentsTotal > 0 ? Math.round((settled / intentsTotal) * 1000) / 10 : 0;
            return { settled, failed, conversion, abandoned: Number(abandoned[0]?.count || 0) };
          })(),
        },
        tips: {
          ordersWithTip: Number(tipStats?.ordersWithTip || 0),
          totalTip: Number(tipStats?.totalTip || 0),
        },
        weekly: weekly.map((r) => ({ week: r.week, method: r.method, total: Number(r.total) })),
      };
    }),

  // ── SEGURIDAD DE CUENTAS: una cuenta por número, dedupe identidad ──
  getAccountSecurity: godAdminProcedure.query(async ({ ctx }) => {
    const [totals] = await ctx.coreDb
      .select({
        totalUsers: sql<number>`COUNT(*)`,
        withPhone: sql<number>`COUNT(*) FILTER (WHERE ${users.phoneNumber} IS NOT NULL)`,
        withTelegram: sql<number>`COUNT(*) FILTER (WHERE ${users.telegramId} IS NOT NULL)`,
        withEmail: sql<number>`COUNT(*) FILTER (WHERE ${users.email} IS NOT NULL)`,
        withUsername: sql<number>`COUNT(*) FILTER (WHERE ${users.username} IS NOT NULL)`,
        noIdentity: sql<number>`COUNT(*) FILTER (WHERE ${users.phoneNumber} IS NULL AND ${users.telegramId} IS NULL AND ${users.email} IS NULL)`,
        last7: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= NOW() - INTERVAL '7 days')`,
        last30: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= NOW() - INTERVAL '30 days')`,
        affiliates: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'AFFILIATE')`,
      })
      .from(users);

    // Cuentas huérfanas/OTP-only: sin identidad real ni username (no pueden ser reclamadas)
    const orphanAccounts = await ctx.coreDb
      .select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(
        sql`${users.phoneNumber} IS NULL OR BTRIM(${users.phoneNumber}) = ''`,
        sql`${users.telegramId} IS NULL`,
        sql`${users.email} IS NULL OR BTRIM(${users.email}) = ''`
      ))
      .orderBy(desc(users.createdAt))
      .limit(20);

    // Normalización de identidad: números duplicados tras limpiar (+52, espacios, guiones)
    const dupPhones = await ctx.coreDb.execute(sql`
      SELECT regexp_replace(COALESCE("phoneNumber",''), '[^0-9]', '', 'g') AS digits, COUNT(*) AS n
      FROM "users"
      WHERE "phoneNumber" IS NOT NULL AND BTRIM(regexp_replace(COALESCE("phoneNumber",''), '[^0-9]', '', 'g')) <> ''
      GROUP BY digits HAVING COUNT(*) > 1
      ORDER BY n DESC LIMIT 10`);

    // Uniqueness real a nivel DB (índices únicos existen o no)
    const uniqueIndexes = await ctx.coreDb.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'users' AND indexdef ILIKE '%UNIQUE%'

      ORDER BY indexname`).then((r: unknown) => ((r as { rows?: unknown[] }).rows ?? r) as Array<{ indexname: string }>);

    // ── Investigación de MULTI-CUENTA: vinculación de identidades ──
    // a) Gmail normalizado: Google ignora puntos y todo lo que va tras '+' en
    //    el inbox → marco.del.toro+3@gmail.com ES marcodeltoro@gmail.com
    const gmailClusters = await ctx.coreDb.execute(sql`
      SELECT
        regexp_replace(split_part(regexp_replace(LOWER("email"), '\\.gmail', 'gmail'), '@', 1), '\\.', '', 'g') AS inbox,
        (regexp_match(LOWER("email"), '\\+([^@]+)@'))[1] AS alias_tag,
        COUNT(*) AS n,
        string_agg(COALESCE("username", LEFT(id, 8)), ', ') AS accounts
      FROM "users"
      WHERE "email" ILIKE '%@gmail.com' OR "email" ILIKE '%@googlemail.com'
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
      ORDER BY n DESC LIMIT 10`);
    // b) Misma IP confiable usada por distintas cuentas (mismo hogar/dispositivo)
    const ipSharing = await ctx.coreDb.execute(sql`
      SELECT t."ipAddress" AS ip, COUNT(DISTINCT t."userId") AS n,
             string_agg(DISTINCT COALESCE(u."username", LEFT(u.id, 8)), ', ') AS accounts
      FROM "trustedSessions" t LEFT JOIN "users" u ON u.id = t."userId"
      WHERE t."ipAddress" IS NOT NULL AND BTRIM(t."ipAddress") <> ''
      GROUP BY t."ipAddress"
      HAVING COUNT(DISTINCT t."userId") > 1
      ORDER BY n DESC LIMIT 10`);
    // c) Mismo dispositivo (deviceName + userAgent) con varias cuentas
    const deviceSharing = await ctx.coreDb.execute(sql`
      SELECT COALESCE(t."deviceName", '?') AS device, LEFT(COALESCE(t."userAgent", '?'), 60) AS agent,
             COUNT(DISTINCT t."userId") AS n,
             string_agg(DISTINCT COALESCE(u."username", LEFT(u.id, 8)), ', ') AS accounts
      FROM "trustedSessions" t LEFT JOIN "users" u ON u.id = t."userId"
      GROUP BY device, agent
      HAVING COUNT(DISTINCT t."userId") > 1
      ORDER BY n DESC LIMIT 10`);
    // d) Push token físico re-registrado bajo otra cuenta: MISMO teléfono
    const tokenHistory = await ctx.coreDb.execute(sql`
      SELECT LEFT(p.token, 24) AS token_prefix, COUNT(DISTINCT u.id) AS n,
             string_agg(DISTINCT COALESCE(u."username", LEFT(u.id, 8)), ', ') AS accounts
      FROM "pushDevices" p LEFT JOIN "users" u ON u.id = p."userId"
      WHERE p.token IS NOT NULL
      GROUP BY p.token HAVING COUNT(DISTINCT u.id) > 1 LIMIT 5`);
    // e) Reciben en la MISMA wallet TON (hard signal de misma persona)
    const walletClusters = await ctx.coreDb.execute(sql`
      SELECT l."payeeSubjectId" AS subject, COUNT(*) AS n
      FROM "ledgerEntries" l
      WHERE l."type" = 'TRANSFER'
      GROUP BY subject
      HAVING COUNT(*) >= 10 LIMIT 5`);

    const unwrap = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? r) as Array<Record<string, unknown>>;

    return {
      totals: {
        totalUsers: Number(totals?.totalUsers || 0),
        withPhone: Number(totals?.withPhone || 0),
        withTelegram: Number(totals?.withTelegram || 0),
        withEmail: Number(totals?.withEmail || 0),
        withUsername: Number(totals?.withUsername || 0),
        noIdentity: Number(totals?.noIdentity || 0),
        newLast7: Number(totals?.last7 || 0),
        newLast30: Number(totals?.last30 || 0),
        affiliates: Number(totals?.affiliates || 0),
      },
      // Una cuenta por número: garantizado por UNIQUE de phoneNumber en DB
      oneAccountPerPhone: {
        enforced: uniqueIndexes.some((i) => i.indexname.includes("phoneNumber")),
        indexes: uniqueIndexes.map((i) => i.indexname),
        duplicatePhonesAfterNormalize: unwrap(dupPhones),
      },
      orphanAccounts: orphanAccounts.map((u) => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
      })),
      identityLinkSignals: {
        gmailClusters: unwrap(gmailClusters),
        ipSharing: unwrap(ipSharing),
        deviceSharing: unwrap(deviceSharing),
        tokenHistory: unwrap(tokenHistory),
        walletClusters: unwrap(walletClusters),
      },
    };
  }),

  // ── NEGOCIO / VC: crecimiento, GMV, retención, campañas (upsell) ──
  getGrowthMetrics: godAdminProcedure
    .input(z.object({ months: z.number().int().min(3).max(24).default(12) }))
    .query(async ({ ctx, input }) => {
      // GMV de órdenes completadas por mes
      const gmvByMonth = await ctx.restaurantDb
        .select({
          month: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'Mon YYYY')`,
          gmv: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          orderCount: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .where(and(inArray(orders.status, ["COMPLETED", "PAID"]), gte(orders.createdAt, sql`NOW() - (INTERVAL '1 month' * ${input.months})`)))
        .groupBy(sql`date_trunc('month', ${orders.createdAt})`)
        .orderBy(sql`date_trunc('month', ${orders.createdAt})`);

      // Nuevos usuarios por mes (coreDb)
      const newUsersByMonth = await ctx.coreDb
        .select({
          month: sql<string>`to_char(date_trunc('month', ${users.createdAt}), 'Mon YYYY')`,
          count: sql<number>`COUNT(*)`,
        })
        .from(users)
        .where(gte(users.createdAt, sql`NOW() - (INTERVAL '1 month' * ${input.months})`))
        .groupBy(sql`date_trunc('month', ${users.createdAt})`)
        .orderBy(sql`date_trunc('month', ${users.createdAt})`);

      // MAU aproximado: usuarios con actividad en ledger en el mes
      const mauByMonth = await ctx.restaurantDb
        .select({
          month: sql<string>`to_char(date_trunc('month', ${ledgerEntries.createdAt}), 'Mon YYYY')`,
          activeUsers: sql<number>`COUNT(DISTINCT ${ledgerEntries.payeeSubjectId})`,
        })
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.type, "EARN"), gte(ledgerEntries.createdAt, sql`NOW() - (INTERVAL '1 month' * ${input.months})`)))
        .groupBy(sql`date_trunc('month', ${ledgerEntries.createdAt})`)
        .orderBy(sql`date_trunc('month', ${ledgerEntries.createdAt})`);

      // Top comercios por GMV (upsell: mayor GMV sin campaña = pitch de campaña)
      const topBusinesses = (await ctx.restaurantDb.execute(sql`
        SELECT r.name AS restaurant, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS gmv
        FROM "orders" o
        JOIN "branches" b ON b.id = o."branchId"
        JOIN "restaurants" r ON r.id = b."restaurantId"
        WHERE o.status IN ('COMPLETED', 'PAID')
          AND o."createdAt" >= NOW() - (INTERVAL '1 day' * 90)
        GROUP BY r.name
        ORDER BY gmv DESC
        LIMIT 10`).then((x: unknown) => ((x as { rows?: unknown[] }).rows ?? x))) as Array<{ restaurant: string; orders: number; gmv: number }>;

      // Campañas: ROI y señales de upsell
      const campaignRows = await ctx.coreDb
        .select({
          id: affiliateCampaigns.id,
          businessId: affiliateCampaigns.businessId,
          type: affiliateCampaigns.campaignType,
          status: affiliateCampaigns.status,
          rewardPercentage: affiliateCampaigns.rewardPercentage,
          budget: affiliateCampaigns.budgetBunz,
          spent: affiliateCampaigns.budgetSpent,
          redemptions: affiliateCampaigns.redemptionCount,
          fiatSpent: sql<number>`COALESCE((SELECT SUM(${campaignRedemptions.fiatSpent}) FROM ${campaignRedemptions} WHERE ${campaignRedemptions.campaignId} = ${affiliateCampaigns.id}), 0)`,
        })
        .from(affiliateCampaigns)
        .orderBy(desc(affiliateCampaigns.createdAt))
        .limit(30);

      const campaigns = campaignRows.map((c) => ({
        ...c,
        budget: Number(c.budget),
        spent: Number(c.spent),
        utilization: c.budget > 0 ? Math.round((Number(c.spent) / Number(c.budget)) * 100) : 0,
        fiatSpent: Number(c.fiatSpent || 0),
        // Señales de venta:
        upsell:
          c.status === "ACTIVE" && c.budget > 0 && (Number(c.spent) / Number(c.budget)) >= 0.8
            ? "BUDGET_AGOTANDOSE" // su campaña funciona: vender presupuesto mayor
            : !["CANCELLED", "EXPIRED"].includes(c.status) && c.redemptions === 0
            ? "SIN_REDENCIONES" // no funciona: vender optimización de campaña
            : null,
      }));

      // Liabilidad de Bunz: minteados vs quemados
      const [liability] = await ctx.restaurantDb
        .select({
          minted: sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} IN ('EARN','MINT')), 0)`,
          spentBunz: sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} = 'SPEND'), 0)`,
        })
        .from(ledgerEntries);

      return {
        gmvByMonth: gmvByMonth.map((r) => ({ month: r.month, gmv: Number(r.gmv), orders: Number(r.orderCount) })),
        newUsersByMonth: newUsersByMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
        mauByMonth: mauByMonth.map((r) => ({ month: r.month, activeUsers: Number(r.activeUsers) })),
        topBusinesses: topBusinesses.map((r) => ({ restaurant: r.restaurant, orders: Number(r.orders), gmv: Number(r.gmv) })),
        campaigns,
        bunzLiability: {
          minted: Number(liability?.minted || 0),
          spent: Number(liability?.spentBunz || 0),
          outstanding: Number(liability?.minted || 0) - Number(liability?.spentBunz || 0),
        },
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
