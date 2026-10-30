import { z } from "zod";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { reconciliationRequests, ownedBusinesses, users, auditEntries } from "@rabbitty/database-core/schema";
import { ledgerEntries } from "@rabbitty/database-restaurant/schema";
import { orders, branches, restaurants } from "@rabbitty/database-restaurant/schema";
import { isGodAdminIdentity } from "../services/god2fa";
import { miniappClient } from "../services/miniapp-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = any;

const OPEN_STATUSES = ["PENDING_AFFILIATE", "AFFILIATE_APPROVED", "AFFILIATE_REJECTED", "PENDING_GOD", "DELIVERY_PROCESSING"];

/** Snapshot contable: expected − credited − pending (calculado por el servidor). */
async function computeClaimable(
  coreDb: Ctx,
  restaurantDb: Ctx,
  orderId: string,
  businessId: string
) {
  const [order] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });

  // Reward rate vigente del negocio
  let rewardPercentage = 20;
  const [biz] = await coreDb.select({ rewardPercentage: ownedBusinesses.rewardPercentage })
    .from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
  if (biz?.rewardPercentage != null) rewardPercentage = biz.rewardPercentage;

  const expected = Math.max(0, Math.floor(Number(order.total || 0) * (rewardPercentage / 100)));

  // Acreditado en ledger para esta orden (mint POS o claim de ticket)
  const keys = [`pos_rwd_${orderId}`, `claim_ticket_${orderId}`];
  const creditedRows = await coreDb.select({ amount: ledgerEntries.amount })
    .from(ledgerEntries)
    .where(and(inArray(ledgerEntries.idempotencyKey, keys), eq(ledgerEntries.type, "EARN")));
  const credited = creditedRows.reduce((s: number, r: { amount: number | null }) => s + Number(r.amount || 0), 0);

  // Pendiente en vault (no reclamada)
  const vaultRows = await coreDb.execute(
    sql`SELECT COALESCE(SUM("bunzAmount"), 0) AS total FROM "pendingVaults" WHERE "orderId" = ${orderId} AND status != 'CLAIMED'`
  ).then((r: unknown) => Number(((r as { rows?: Array<{ total: number | string }> }).rows || (r as unknown as Array<{ total: number | string }>))[0]?.total ?? 0));

  const claimed = Math.max(0, expected - credited - pending_val(vaultRows));
  return {
    order,
    expected,
    credited,
    pending: pending_val(vaultRows),
    claimed,
    rewardRuleRef: `rewardPercentage:${rewardPercentage}`,
  };
}

function pending_val(v: number | string): number {
  return Number(v || 0);
}

async function assertBusinessStaffOrOwner(ctx: Ctx, businessId: string) {
  if (isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) return;
  const [biz] = await ctx.coreDb.select({ id: ownedBusinesses.id, ownerId: ownedBusinesses.ownerId })
    .from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
  if (biz?.ownerId === ctx.userId) return;
  if (ctx.branchId) {
    const [br] = await ctx.restaurantDb.select({ restaurantId: branches.restaurantId })
      .from(branches).where(eq(branches.id, ctx.branchId)).limit(1);
    if (br?.restaurantId) {
      const [rest] = await ctx.restaurantDb.select({ businessId: restaurants.businessId })
        .from(restaurants).where(eq(restaurants.id, br.restaurantId)).limit(1);
      if (rest?.businessId === businessId) return;
    }
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Sin acceso a este negocio" });
}

async function notifyGods(ctx: Ctx, title: string, message: string, type: string, route: string) {
  void route;
  try {
    const godRows = await ctx.coreDb.select({ id: users.id })
      .from(users).where(eq(users.role, "ADMIN"));
    for (const g of godRows) {
      await ctx.coreDb.execute(
        sql`INSERT INTO "notifications" ("id", "userId", "title", "message", "type") VALUES (gen_random_uuid()::text, ${g.id}, ${title}, ${message}, ${type})`
      );
    }
  } catch (e) {
    console.error("[reconciliation] notify gods failed:", e);
  }
}

export const reconciliationRouter = router({
  /** ── AFILIADO: lista de conciliaciones de su negocio ── */
  listForBusiness: protectedProcedure
    .input(z.object({ businessId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBusinessStaffOrOwner(ctx, input.businessId);
      // Recuperación perezosa: DELIVERY_PROCESSING stale (>10 min) → re-verificar
      await recoverStuckDeliveries(ctx, input.businessId);
      return await ctx.coreDb
        .select()
        .from(reconciliationRequests)
        .where(eq(reconciliationRequests.businessId, input.businessId))
        .orderBy(desc(reconciliationRequests.createdAt))
        .limit(100);
    }),

  /** ── AFILIADO: aprueba o disputa (ninguna cierra — ambas van a God) ── */
  decide: protectedProcedure
    .input(z.object({
      requestId: z.string(),
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().min(3).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const [req] = await ctx.coreDb.select().from(reconciliationRequests)
        .where(eq(reconciliationRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Conciliación no encontrada" });
      await assertBusinessStaffOrOwner(ctx, req.businessId);
      if (req.status !== "PENDING_AFFILIATE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ya fue resuelta por el negocio" });
      }
      await ctx.coreDb.update(reconciliationRequests).set({
        status: input.decision === "APPROVED" ? "AFFILIATE_APPROVED" : "AFFILIATE_REJECTED",
        affiliateNote: input.note,
        affiliateUserId: ctx.userId,
        affiliateRespondedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(reconciliationRequests.id, input.requestId));

      await ctx.coreDb.insert(auditEntries).values({
        userId: ctx.userId,
        action: `RECONCILIATION_AFFILIATE_${input.decision}`,
        resource: "reconciliationRequests",
        resourceId: input.requestId,
        details: input.note,
      }).catch(() => {});

      await notifyGods(
        ctx,
        `⚖️ Conciliación ${input.decision === "APPROVED" ? "aprobada" : "disputada"} por el negocio`,
        `Reclamación de ${req.claimedBunz} Bunz (orden ${req.orderId.slice(0, 8)}) — espera autorización God`,
        "SYSTEM",
        "/god/conciliaciones"
      );
      return { success: true };
    }),

  /** ── GOD: lista global con bitácora ── */
  listForGod: protectedProcedure.query(async ({ ctx }) => {
    if (!isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo God Admin" });
    }
    // Recuperación perezosa global
    const stuck = await ctx.coreDb.select().from(reconciliationRequests)
      .where(and(eq(reconciliationRequests.status, "DELIVERY_PROCESSING"), lt(reconciliationRequests.updatedAt, new Date(Date.now() - 10 * 60 * 1000))))
      .limit(20);
    for (const r of stuck) await recoverStuckDeliveries(ctx, r.businessId);
    return await ctx.coreDb.select().from(reconciliationRequests)
      .orderBy(desc(reconciliationRequests.createdAt)).limit(200);
  }),

  /** ── GOD: autoriza la entrega (minta vía el servicio idempotente existente) ── */
  authorize: protectedProcedure
    .input(z.object({ requestId: z.string(), godNote: z.string().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (!isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo God Admin puede autorizar entregas" });
      }

      // Lock de la fila + transición a DELIVERY_PROCESSING (anti doble-clic/concurrencia)
      const delivered = await ctx.coreDb.transaction(async (tx: Ctx) => {
        const [locked] = await tx.select().from(reconciliationRequests)
          .where(eq(reconciliationRequests.id, input.requestId))
          .for("update");
        if (!locked) throw new TRPCError({ code: "NOT_FOUND", message: "Conciliación no encontrada" });
        if (locked.status !== "PENDING_GOD" && locked.status !== "AFFILIATE_APPROVED" && locked.status !== "AFFILIATE_REJECTED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Estado no autorizable (${locked.status})` });
        }
        if (locked.claimedBunz <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No hay diferencia pendiente por conciliar (ya acreditada)" });
        }
        await tx.update(reconciliationRequests).set({
          status: "DELIVERY_PROCESSING",
          godNote: input.godNote,
          godUserId: ctx.userId,
          godResolvedAt: new Date(),
          deliveryAttempts: locked.deliveryAttempts + 1,
          updatedAt: new Date(),
        }).where(eq(reconciliationRequests.id, input.requestId));
        return true;
      });
      void delivered;

      // ── Entrega vía el mint idempotente EXISTENTE (pos_rwd_<orderId>) ──
      // Si falla la entrega, la conciliación queda en DELIVERY_PROCESSING → reintentable sin duplicar.
      try {
        // Resolver el teléfono del comprador + businessId real
        const [req] = await ctx.coreDb.select().from(reconciliationRequests)
          .where(eq(reconciliationRequests.id, input.requestId)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Conciliación desapareció" });
        const [buyer] = await ctx.coreDb.select({ phone: users.phoneNumber, telegramId: users.telegramId })
          .from(users).where(eq(users.id, req.userId)).limit(1);
        const phone = buyer?.phone || buyer?.telegramId || req.userId;
        // Orden → branchId → businessId real (la miniapp también resuelve defensivamente)
        const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, req.orderId)).limit(1);
        const secret = process.env.RABBITTY_API_SECRET;
        if (!secret || !process.env.RABBITTY_MINIAPP_URL) {
          throw new Error("RABBITTY_MINIAPP_URL/RABBITTY_API_SECRET no configurados en admin");
        }
        const res = await miniappClient.rewardBunz(phone, Number(order?.total || 0), req.orderId, req.businessId);
        if (!res?.success) throw new Error(res?.message || "El mint no confirmó éxito");

        // Verificación contable: el ledger DEBE tener el movimiento
        const [entry] = await ctx.coreDb.select({ id: ledgerEntries.id })
          .from(ledgerEntries)
          .where(eq(ledgerEntries.idempotencyKey, `pos_rwd_${req.orderId}`)).limit(1);
        if (!entry) throw new Error("El mint confirmó pero no hay entrada en el ledger");

        await ctx.coreDb.update(reconciliationRequests).set({
          status: "DELIVERED",
          ledgerEntryId: entry.id,
          deliveredAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(reconciliationRequests.id, input.requestId));

        await ctx.coreDb.insert(auditEntries).values({
          userId: ctx.userId,
          action: "RECONCILIATION_GOD_DELIVERED",
          resource: "reconciliationRequests",
          resourceId: input.requestId,
          details: `${req.claimedBunz} Bunz · ${input.godNote}`,
        }).catch(() => {});

        return { success: true, status: "DELIVERED", ledgerEntryId: entry.id };
      } catch (err: any) {
        // No DELIVERED: queda en DELIVERY_PROCESSING para reintentar sin duplicar
        await ctx.coreDb.update(reconciliationRequests).set({
          updatedAt: new Date(),
          godNote: `${input.godNote} · reintento pendiente: ${String(err?.message || err).slice(0, 200)}`,
        }).where(eq(reconciliationRequests.id, input.requestId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Entrega pendiente de reintento: ${String(err?.message || err).slice(0, 120)}` });
      }
    }),

  /** ── GOD: rechazo definitivo ── */
  godReject: protectedProcedure
    .input(z.object({ requestId: z.string(), godNote: z.string().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (!isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo God Admin" });
      }
      const [req] = await ctx.coreDb.select().from(reconciliationRequests)
        .where(eq(reconciliationRequests.id, input.requestId)).limit(1);
      if (!req || !["PENDING_GOD", "AFFILIATE_APPROVED", "AFFILIATE_REJECTED"].includes(req.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Estado no rechazable" });
      }
      await ctx.coreDb.update(reconciliationRequests).set({
        status: "GOD_REJECTED",
        godNote: input.godNote,
        godUserId: ctx.userId,
        godResolvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(reconciliationRequests.id, input.requestId));

      await ctx.coreDb.insert(auditEntries).values({
        userId: ctx.userId,
        action: "RECONCILIATION_GOD_REJECTED",
        resource: "reconciliationRequests",
        resourceId: input.requestId,
        details: input.godNote,
      }).catch(() => {});
      return { success: true };
    }),
});

/** DELIVERY_PROCESSING stale: re-verifica el ledger; si el mint ya acreditó → DELIVERED; si no, reintenta. */
async function recoverStuckDeliveries(ctx: Ctx, businessId?: string) {
  const stale = await ctx.coreDb.select().from(reconciliationRequests)
    .where(and(
      eq(reconciliationRequests.status, "DELIVERY_PROCESSING"),
      lt(reconciliationRequests.updatedAt, new Date(Date.now() - 10 * 60 * 1000)),
      ...(businessId ? [eq(reconciliationRequests.businessId, businessId)] : []),
    ))
    .limit(10);

  for (const r of stale) {
    const [entry] = await ctx.coreDb.select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `pos_rwd_${r.orderId}`)).limit(1);
    if (entry) {
      await ctx.coreDb.update(reconciliationRequests).set({
        status: "DELIVERED", ledgerEntryId: entry.id, deliveredAt: new Date(), updatedAt: new Date(),
      }).where(eq(reconciliationRequests.id, r.id));
      continue;
    }
    // Reintento del mint (idempotente — jamás duplica)
    if (r.deliveryAttempts >= 5) {
      await ctx.coreDb.update(reconciliationRequests).set({
        status: "PENDING_GOD", updatedAt: new Date(),
        godNote: `${r.godNote || ""} · entrega falló ${r.deliveryAttempts} veces — revisar manualmente`,
      }).where(eq(reconciliationRequests.id, r.id));
      continue;
    }
    try {
      const [buyer] = await ctx.coreDb.select({ phone: users.phoneNumber, telegramId: users.telegramId })
        .from(users).where(eq(users.id, r.userId)).limit(1);
      const phone = buyer?.phone || buyer?.telegramId || r.userId;
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, r.orderId)).limit(1);
      await miniappClient.rewardBunz(phone, Number(order?.total || 0), r.orderId, r.businessId);
      const [entry2] = await ctx.coreDb.select({ id: ledgerEntries.id })
        .from(ledgerEntries).where(eq(ledgerEntries.idempotencyKey, `pos_rwd_${r.orderId}`)).limit(1);
      if (entry2) {
        await ctx.coreDb.update(reconciliationRequests).set({
          status: "DELIVERED", ledgerEntryId: entry2.id, deliveredAt: new Date(), updatedAt: new Date(),
        }).where(eq(reconciliationRequests.id, r.id));
      }
    } catch {
      await ctx.coreDb.update(reconciliationRequests).set({ updatedAt: new Date() }).where(eq(reconciliationRequests.id, r.id));
    }
  }
}
