import { router, protectedProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const dwellAnalyticsRouter = router({
  /** Permanencia de rabbitters en el negocio (owner/staff/god). Sesiones cierran lazy a los 90 min sin ping. */
  getDwellStats: protectedProcedure.query(async ({ ctx }) => {
    const { resolveMerchantContext } = await import("../services/merchantContext");
    const mctx = await resolveMerchantContext(ctx);

    let bizFilterSql = sql``;
    if (!mctx.isGod) {
      if (mctx.businessIds.length === 0) {
        return { liveNow: 0, sessionsToday: 0, sessions7d: 0, avgDwell7d: 0, longest7d: 0, repeatUsers7d: 0, lastSessions: [] };
      }
      bizFilterSql = sql`AND "businessId" IN (${mctx.businessIds.join(",")})`;
    }

    const coreDb = ctx.coreDb;
    try {
      // Cierre lazy de sesiones stale (>90 min sin ping)
      await coreDb.execute(
        sql`UPDATE "presenceSessions" SET "endedAt" = "lastPingAt", "updatedAt" = now()
            WHERE "endedAt" IS NULL AND "lastPingAt" < now() - interval '90 minutes'`
      );

      const statsRes = await coreDb.execute(sql`
        SELECT
          (SELECT count(*)::int FROM "presenceSessions" WHERE "endedAt" IS NULL ${bizFilterSql}) AS "liveNow",
          (SELECT count(*)::int FROM "presenceSessions" WHERE "startedAt" >= now() - interval '24 hours' ${bizFilterSql}) AS "sessionsToday",
          (SELECT count(*)::int FROM "presenceSessions" WHERE "startedAt" >= now() - interval '7 days' ${bizFilterSql}) AS "sessions7d",
          (SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (COALESCE("endedAt", now()) - "startedAt")) / 60)::numeric, 1), 0)::int
             FROM "presenceSessions"
            WHERE "startedAt" >= now() - interval '7 days' ${bizFilterSql}) AS "avgDwell7d",
          (SELECT COALESCE(round(max(EXTRACT(EPOCH FROM (COALESCE("endedAt", now()) - "startedAt")) / 60)::numeric), 0)::int
             FROM "presenceSessions" WHERE "startedAt" >= now() - interval '7 days' ${bizFilterSql}) AS "longest7d",
          (SELECT count(*)::int FROM (
             SELECT "userId" FROM "presenceSessions"
              WHERE "startedAt" >= now() - interval '7 days' ${bizFilterSql}
              GROUP BY "userId" HAVING count(*) >= 2) AS r) AS "repeatUsers7d"
      `);
      const stats = ((statsRes as { rows?: Array<any> }).rows || (statsRes as unknown as Array<any>))[0];

      const lastRes = await coreDb.execute(sql`
        SELECT s.id, s."userId", s."businessId", s."source", s."startedAt", s."lastPingAt", s."endedAt",
              round(EXTRACT(EPOCH FROM (COALESCE(s."endedAt", CASE WHEN s."lastPingAt" < now() - interval '90 minutes' THEN s."lastPingAt" ELSE now() END) - s."startedAt")) / 60.0)::int AS "dwellMin",
              u.username, u."firstName", u."lastName", b.name AS "businessName"
            FROM "presenceSessions" s
            LEFT JOIN users u ON u.id = s."userId"
            LEFT JOIN "ownedBusinesses" b ON b.id = s."businessId"
            WHERE TRUE ${bizFilterSql}
            ORDER BY s."startedAt" DESC LIMIT 8
      `);
      const lastSessions = (lastRes as { rows?: Array<any> }).rows || (lastRes as unknown as Array<any>);

      return {
        liveNow: Number(stats?.liveNow ?? 0),
        sessionsToday: Number(stats?.sessionsToday ?? 0),
        sessions7d: Number(stats?.sessions7d ?? 0),
        avgDwell7d: Number(stats?.avgDwell7d ?? 0),
        longest7d: Number(stats?.longest7d ?? 0),
        repeatUsers7d: Number(stats?.repeatUsers7d ?? 0),
        lastSessions,
      };
    } catch (err) {
      console.error("[DWELL STATS]", err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudieron calcular las métricas de permanencia" });
    }
  }),
});
