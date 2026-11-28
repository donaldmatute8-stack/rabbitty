import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  businessOffers,
  notifications,
  offerRedemptions,
  ownedBusinesses,
  users,
} from "@rabbitty/database-core/schema";
import { ledgerEntries } from "@rabbitty/database-restaurant/schema";

/**
 * ── Expiración de canjes ───────────────────────────────────────────────────
 * Un código RESERVED que vence sin validarse no puede costarle dinero al
 * Rabbitter: se devuelve el Bunz, se restaura el respaldo del negocio y el
 * stock, se marca EXPIRED y se deja asiento REFUND.
 *
 * Idempotente por asiento (`offer_expired_<redemptionId>`), así que el cron
 * puede correr cada 5 minutos sin duplicar devoluciones.
 */
export async function expireOfferRedemptions(
  db: any,
  options: { limit?: number; notify?: boolean } = {},
): Promise<{ expired: number; refundedBunz: number }> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 200));
  const notify = options.notify !== false;

  const due = await db
    .select()
    .from(offerRedemptions)
    .where(and(eq(offerRedemptions.status, "RESERVED"), lte(offerRedemptions.expiresAt, new Date())))
    .limit(limit);

  let expired = 0;
  let refundedBunz = 0;

  for (const row of due) {
    try {
      const done = await db.transaction(async (tx: any) => {
        const [locked] = await tx
          .select()
          .from(offerRedemptions)
          .where(eq(offerRedemptions.id, row.id))
          .limit(1)
          .for("update");
        if (!locked || locked.status !== "RESERVED") return false;

        await tx
          .update(users)
          .set({ totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - ${locked.bunzCost})` })
          .where(eq(users.id, locked.userId));

        await tx
          .update(ownedBusinesses)
          .set({ bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) + ${locked.bunzCost}` })
          .where(eq(ownedBusinesses.id, locked.businessId));

        await tx
          .update(businessOffers)
          .set({ stockUsed: sql`GREATEST(0, ${businessOffers.stockUsed} - 1)` })
          .where(eq(businessOffers.id, locked.offerId));

        await tx
          .update(offerRedemptions)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(eq(offerRedemptions.id, locked.id));

        const [biz] = await tx
          .select({ sandbox: ownedBusinesses.sandbox })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.id, locked.businessId))
          .limit(1);

        await tx
          .insert(ledgerEntries)
          .values({
            payerSubjectId: `biz_${locked.businessId}`,
            payeeSubjectId: `usr_${locked.userId}`,
            amount: locked.bunzCost,
            currency: "BUNZ",
            type: "REFUND",
            referenceId: locked.id,
            idempotencyKey: `offer_expired_${locked.id}`,
            sandbox: Boolean(biz?.sandbox),
            metadata: { offerId: locked.offerId, code: locked.code, reason: "OFFER_CODE_EXPIRED" },
          })
          .onConflictDoNothing({ target: ledgerEntries.idempotencyKey });

        if (notify) {
          await tx.insert(notifications).values({
            userId: locked.userId,
            title: "Tu canje venció",
            message: `Te devolvimos ${locked.bunzCost} Bunz porque el código ${locked.code} no se usó a tiempo.`,
            type: "SYSTEM",
            route: "/profile/wallet",
          });
        }

        return true;
      });

      if (done) {
        expired += 1;
        refundedBunz += Number(row.bunzCost);
      }
    } catch (error) {
      console.error(
        "[offers-expiry] no se pudo expirar",
        row.id,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { expired, refundedBunz };
}

/** Para el panel: cuántos canjes están pendientes de validar en un negocio. */
export async function countPendingRedemptions(db: any, businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(offerRedemptions)
    .where(and(eq(offerRedemptions.businessId, businessId), inArray(offerRedemptions.status, ["RESERVED"])));
  return Number(row?.n ?? 0);
}
