import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { and, eq, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  behaviorRules,
  ownedBusinesses,
  users,
} from "@rabbitty/database-core/schema";
import { ledgerEntries as rLedger } from "@rabbitty/database-restaurant/schema";
import { resolveMerchantContext } from "../services/merchantContext";

/** Valida acceso: god global, owner/staff del negocio. Devuelve businessId elegido. */
async function assertRuleAccess(ctx: any, businessId: string) {
  const mctx = await resolveMerchantContext(ctx);
  if (mctx.isGod) return businessId;
  if (!mctx.businessIds.includes(businessId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No administras este negocio" });
  }
  return businessId;
}

const paramsSchema = z.object({
  minDwellMinutes: z.number().int().min(5).max(600).optional(),
  windowDays: z.number().int().min(1).max(90).optional(),
  maxSpendBunz: z.number().int().min(0).optional(),
  minVisits: z.number().int().min(1).max(50).optional(),
  daysSinceLastVisit: z.number().int().min(3).max(365).optional(),
  targetCategory: z.string().max(60).optional(),
}).passthrough();

const actionSchema = z.object({
  type: z.enum(["PROMO", "BUNZ"]),
  bunzAmount: z.number().int().min(1).max(500).optional(),
  title: z.string().min(3).max(80),
  message: z.string().min(3).max(300),
});

export const behaviorRulesRouter = router({
  /** Lista de reglas del negocio con uso de presupuesto. */
  listRules: protectedProcedure
    .input(z.object({ businessId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertRuleAccess(ctx, input.businessId);
      return await ctx.coreDb.select().from(behaviorRules)
        .where(eq(behaviorRules.businessId, input.businessId))
        .orderBy(desc(behaviorRules.createdAt))
        .limit(50);
    }),

  /** Crear/regalar regla. */
  saveRule: protectedProcedure
    .input(z.object({
      businessId: z.string(),
      id: z.string().optional(),
      name: z.string().min(3).max(80),
      triggerType: z.enum(["HIGH_DWELL_LOW_SPEND", "CHURNED_REGULAR", "CROSS_AFFINITY"]),
      triggerParams: paramsSchema,
      action: actionSchema,
      budgetBunz: z.number().int().min(0).max(5000).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertRuleAccess(ctx, input.businessId);
      if (input.action.type === "BUNZ" && !input.action.bunzAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Acción BUNZ requiere bunzAmount" });
      }
      const values = {
        businessId: input.businessId,
        name: input.name,
        triggerType: input.triggerType,
        triggerParams: input.triggerParams,
        action: input.action,
        budgetBunz: input.budgetBunz,
      };
      if (input.id) {
        await ctx.coreDb.update(behaviorRules).set({ ...values, updatedAt: new Date() })
          .where(and(eq(behaviorRules.id, input.id), eq(behaviorRules.businessId, input.businessId)));
        return { success: true, id: input.id };
      }
      const [created] = await ctx.coreDb.insert(behaviorRules).values(values).returning();
      return { success: true, id: created!.id };
    }),

  toggleRule: protectedProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.coreDb.select().from(behaviorRules).where(eq(behaviorRules.id, input.id)).limit(1);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      await assertRuleAccess(ctx, rule.businessId);
      await ctx.coreDb.update(behaviorRules).set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(behaviorRules.id, input.id));
      return { success: true };
    }),

  /**
   * Motor: evalúa la regla y devuelve los rabbitters que matchean el comportamiento.
   * Todo server-side, con métricas por usuario para que el afiliado decida a quién enviar.
   */
  getRuleMatches: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [rule] = await ctx.coreDb.select().from(behaviorRules).where(eq(behaviorRules.id, input.ruleId)).limit(1);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      await assertRuleAccess(ctx, rule.businessId);
      const p = rule.triggerParams as any;
      const bizId = rule.businessId;
      const windowDays = Number(p.windowDays ?? 14);

      let rows: any[] = [];
      if (rule.triggerType === "HIGH_DWELL_LOW_SPEND") {
        const minDwell = Number(p.minDwellMinutes ?? 60);
        const maxSpend = Number(p.maxSpendBunz ?? 0);
        rows = await ctx.coreDb.execute(sql`
          WITH dwell AS (
            SELECT "userId", round(AVG(EXTRACT(EPOCH FROM (COALESCE("endedAt", "lastPingAt") - "startedAt")) / 60)::numeric) AS avg_min,
                   count(*) AS sessions
            FROM "presenceSessions"
            WHERE "businessId" = ${bizId} AND "startedAt" >= now() - (${windowDays} || ' days')::interval
              AND COALESCE("endedAt", "lastPingAt") > "startedAt"
            GROUP BY "userId"
            HAVING round(AVG(EXTRACT(EPOCH FROM (COALESCE("endedAt", "lastPingAt") - "startedAt")) / 60)::numeric) >= ${minDwell}
          ), spend AS (
            SELECT "payeeSubjectId" AS sid, COALESCE(SUM(amount), 0) AS spent
            FROM "ledger_entries" WHERE "payeeSubjectId" = ${bizId} AND type = 'SPEND'
            GROUP BY "payeeSubjectId"
          )
          SELECT d."userId" AS uid, d.avg_min::int AS "avgMin", COALESCE(s.spent, 0) AS spent, d.sessions
          FROM dwell d LEFT JOIN spend s ON s.sid = 'usr_' || d."userId"
          WHERE COALESCE(s.spent, 0) <= ${maxSpend}
          ORDER BY d.avg_min DESC LIMIT 50
        `).then((r: unknown) => (r as { rows?: Array<any> }).rows || (r as unknown as Array<any>));
      } else if (rule.triggerType === "CHURNED_REGULAR") {
        const minVisits = Number(p.minVisits ?? 3);
        const daysSilent = Number(p.daysSinceLastVisit ?? 21);
        rows = await ctx.coreDb.execute(sql`
          WITH hist AS (
            SELECT "userId", count(*) AS visits, MAX("startedAt") AS last_at
            FROM "presenceSessions" WHERE "businessId" = ${bizId}
            GROUP BY "userId" HAVING count(*) >= ${minVisits}
          )
          SELECT "userId" AS uid, visits, last_at AS "lastVisitAt",
                 EXTRACT(DAY FROM now() - last_at)::int AS "daysSilent"
          FROM hist
          WHERE last_at < now() - (${daysSilent} || ' days')::interval
          ORDER BY last_at DESC LIMIT 50
        `).then((r: unknown) => (r as { rows?: Array<any> }).rows || (r as unknown as Array<any>));
      } else {
        // CROSS_AFFINITY: usuarios con permanencia/consumo en la categoría objetivo que NO me visitan
        const targetCat = String(p.targetCategory ?? "").trim();
        const minDwell = Number(p.minDwellMinutes ?? 30);
        rows = await ctx.coreDb.execute(sql`
          WITH affine AS (
            SELECT ps."userId",
                   sum(EXTRACT(EPOCH FROM (COALESCE(ps."endedAt", ps."lastPingAt") - ps."startedAt")) / 60)::int AS dwell_min,
                   count(DISTINCT ps."businessId") AS venues
            FROM "presenceSessions" ps
            JOIN "ownedBusinesses" ob ON ob.id = ps."businessId"
            WHERE ob.id != ${bizId} AND ob.category ILIKE ${'%' + targetCat + '%'}
              AND ps."startedAt" >= now() - interval '30 days'
              AND COALESCE(ps."endedAt", ps."lastPingAt") > ps."startedAt"
            GROUP BY ps."userId"
            HAVING sum(EXTRACT(EPOCH FROM (COALESCE(ps."endedAt", ps."lastPingAt") - ps."startedAt")) / 60) >= ${minDwell}
          ), mine AS (
            SELECT DISTINCT "userId" FROM "presenceSessions" WHERE "businessId" = ${bizId}
          )
          SELECT a."userId" AS uid, a.dwell_min AS "dwellMin", a.venues
          FROM affine a LEFT JOIN mine m ON m."userId" = a."userId"
          WHERE m."userId" IS NULL
          ORDER BY a.dwell_min DESC LIMIT 50
        `).then((r: unknown) => (r as { rows?: Array<any> }).rows || (r as unknown as Array<any>));
      }

      // Enriquecer con nombre/username
      const out = [];
      for (const row of rows.slice(0, 30)) {
        const [u] = await ctx.coreDb.select({ username: users.username, firstName: users.firstName, lastName: users.lastName })
          .from(users).where(eq(users.id, String(row.uid))).limit(1);
        out.push({
          userId: String(row.uid),
          name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Rabbitter",
          username: u?.username ?? null,
          metrics: row,
        });
      }
      return {
        rule: { id: rule.id, name: rule.name, triggerType: rule.triggerType, params: rule.triggerParams, action: rule.action, budgetBunz: rule.budgetBunz, budgetSpent: rule.budgetSpent },
        matches: out,
      };
    }),

  /**
   * Ejecutar acción: envía la promo (push+in-app) y/o regala Bunz (del stock del
   * comercio, con presupuesto de la regla) — idempotente por regla+usuario por 7 días.
   */
  executeAction: protectedProcedure
    .input(z.object({ ruleId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.coreDb.select().from(behaviorRules).where(eq(behaviorRules.id, input.ruleId)).limit(1);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      await assertRuleAccess(ctx, rule.businessId);
      const action = rule.action as any;
      const idemKey = `rule_${rule.id}_${input.userId}`;

      // Anti-duplicado: un envío de la misma regla al mismo usuario cada 7 días
      const [dup] = await ctx.coreDb.select({ k: rLedger.idempotencyKey }).from(rLedger)
        .where(sql`${rLedger.idempotencyKey} = ${idemKey}`).limit(1);
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "Ya le enviaste esta oferta hace menos de 7 días" });

      let bunzSent = 0;
      if (action.type === "BUNZ") {
        const amt = Number(action.bunzAmount ?? 0);
        if (rule.budgetSpent + amt > rule.budgetBunz) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Presupuesto agotado (${rule.budgetSpent}/${rule.budgetBunz} Bunz usados)` });
        }
        await ctx.coreDb.transaction(async (tx: any) => {
          const [debited] = await tx.update(ownedBusinesses)
            .set({ bunzBalance: sql`GREATEST(0, COALESCE("bunzBalance", 0) - ${amt})` })
            .where(and(eq(ownedBusinesses.id, rule.businessId), sql`COALESCE("bunzBalance", 0) >= ${amt}`))
            .returning({ bunzBalance: ownedBusinesses.bunzBalance });
          if (debited.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Bóveda insuficiente para el regalo" });
          await tx.update(users)
            .set({ totalBunzEarned: sql`COALESCE("totalBunzEarned", 0) + ${amt}` })
            .where(eq(users.id, input.userId));
          await tx.execute(sql`INSERT INTO "ledger_entries" ("id", "payerSubjectId", "payeeSubjectId", amount, currency, type, "referenceId", "idempotencyKey", metadata)
            VALUES (gen_random_uuid()::text, ${rule.businessId}, ${'usr_' + input.userId}, ${amt}, 'BUNZ', 'EARN', ${rule.id}, ${idemKey},
            ${JSON.stringify({ kind: "BEHAVIOR_GIFT", ruleId: rule.id, ruleName: rule.name })}::jsonb)
            ON CONFLICT ("idempotencyKey") DO NOTHING`);
          await tx.update(behaviorRules).set({ budgetSpent: rule.budgetSpent + amt, updatedAt: new Date() })
            .where(eq(behaviorRules.id, rule.id));
        });
        bunzSent = amt;
      }

      // Notificación (post-commit, con deep-link al negocio)
      const { miniappClient } = await import("../services/miniapp-client");
      const [biz] = await ctx.coreDb.select({ name: ownedBusinesses.name }).from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, rule.businessId)).limit(1);
      try {
        await miniappClient.sendNotification({
          userId: input.userId,
          title: action.title || `💌 ${biz?.name || "Un negocio"} tiene algo para ti`,
          message: bunzSent > 0
            ? `${action.message} — te regalamos ${bunzSent} Bunz, ya están en tu billetera.`
            : action.message,
          type: "AFFILIATE",
          route: `/affiliate/${rule.businessId}`,
        } as any);
      } catch (nErr) {
        console.error("[behaviorRules] notify falló:", nErr);
      }

      return { success: true, bunzSent };
    }),
});
