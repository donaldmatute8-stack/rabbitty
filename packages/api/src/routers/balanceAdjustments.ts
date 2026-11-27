import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  businessBalanceAdjustments,
  ownedBusinesses,
} from "@rabbitty/database-core/schema";
import { godAdminProcedure, protectedProcedure, router } from "../trpc";
import { resolveBusinessId } from "../services/rabbitChair";
import { logAudit } from "../middleware/auditLog";

/**
 * ── Ajustes de tesorería con aprobación ─────────────────────────────────────
 * Owner solicita; otro God aprueba o rechaza. No aplica saldos todavía:
 * la aplicación se hace con el flujo God de refill (ledger + auditoría) o con
 * el futuro `apply` cuando exista una transacción cruzada segura.
 */

const requestInput = z.object({
  delta: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, {
    message: "El ajuste no puede ser 0",
  }),
  reason: z.string().trim().min(20).max(300),
});

export const balanceAdjustmentsRouter = router({
  /** Owner del negocio solicita un ajuste. */
  request: protectedProcedure.input(requestInput).mutation(async ({ ctx, input }) => {
    if (ctx.staffRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo el dueño del negocio puede solicitar un ajuste de tesorería.",
      });
    }
    if (!ctx.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesión requerida." });
    }

    const businessId = await resolveBusinessId(ctx.restaurantDb, ctx.branchId);
    const [row] = await ctx.coreDb
      .insert(businessBalanceAdjustments)
      .values({
        id: randomUUID(),
        businessId,
        field: "BUNZ_BALANCE",
        delta: input.delta,
        reason: input.reason,
        requestedBy: ctx.userId,
        status: "PENDING",
        idempotencyKey: `balance_adjustment:${randomUUID()}`,
      })
      .returning();

    logAudit({
      userId: ctx.userId,
      action: "BALANCE_ADJUSTMENT_REQUESTED",
      resource: "businessBalanceAdjustments",
      resourceId: row?.id ?? businessId,
      details: { delta: input.delta, reason: input.reason },
    });

    return row;
  }),

  /** Owner: sus solicitudes. */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.staffRole) return [];
    const businessId = await resolveBusinessId(ctx.restaurantDb, ctx.branchId);
    return ctx.coreDb
      .select()
      .from(businessBalanceAdjustments)
      .where(eq(businessBalanceAdjustments.businessId, businessId))
      .orderBy(desc(businessBalanceAdjustments.createdAt))
      .limit(50);
  }),

  /** God: todas las solicitudes. */
  godList: godAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.coreDb
      .select({
        request: businessBalanceAdjustments,
        businessName: ownedBusinesses.name,
      })
      .from(businessBalanceAdjustments)
      .leftJoin(
        ownedBusinesses,
        eq(ownedBusinesses.id, businessBalanceAdjustments.businessId),
      )
      .orderBy(desc(businessBalanceAdjustments.createdAt))
      .limit(100);

    return rows.map((row) => ({ ...row.request, businessName: row.businessName }));
  }),

  /** God: aprueba o rechaza. Quien solicita no puede aprobar. */
  decide: godAdminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        decision: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.coreDb.transaction(async (tx: any) => {
        const [row] = await tx
          .select()
          .from(businessBalanceAdjustments)
          .where(eq(businessBalanceAdjustments.id, input.id))
          .for("update")
          .limit(1);

        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitud no encontrada." });
        if (row.status !== "PENDING") {
          throw new TRPCError({ code: "CONFLICT", message: "La solicitud ya fue decidida." });
        }
        if (row.requestedBy === ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Quien solicita no puede aprobar su propia solicitud.",
          });
        }

        const [updated] = await tx
          .update(businessBalanceAdjustments)
          .set({
            status: input.decision,
            approvedBy: ctx.userId ?? null,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(businessBalanceAdjustments.id, input.id),
              eq(businessBalanceAdjustments.status, "PENDING"),
            ),
          )
          .returning();

        return updated;
      });

      logAudit({
        userId: ctx.userId ?? null,
        action: `BALANCE_ADJUSTMENT_${input.decision}`,
        resource: "businessBalanceAdjustments",
        resourceId: input.id,
        details: { note: input.note ?? null },
      });

      return result;
    }),
});
