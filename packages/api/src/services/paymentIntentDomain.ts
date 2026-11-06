import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { getRestaurantDb } from "../db";
import { 
  paymentIntents, 
  orders, 
  payments,
  ledgerEntries,
  distributionRules,
  distributionAllocations,
  settlementOperations,
  branches,
  restaurants
} from "@rabbitty/database-restaurant/schema";
import { users, ownedBusinesses } from "@rabbitty/database-core/schema";
import { buildShadowReport, recordShadowReport } from "./payments/shadow";

/**
 * @deprecated RP-0.7 — motor legacy en migración a paymentCore.
 * No añadir nuevos consumidores. Se retira cuando `RABBITTY_PAY_ENGINE_V2`
 * esté activo y `bunz-pay` / `apps/api-server` dejen de usarlo.
 */
import { orderItems as posOrderItems, menuItems as menuItemsTable } from "@rabbitty/database-restaurant/schema";


export type PaymentIntentStatus = 
  | "CREATED"
  | "PENDING"
  | "PENDING_PAYMENT"
  | "AUTHORIZED"
  | "SETTLED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED";

export interface PaymentIntent {
  id: string;
  tenantId: string;
  orderId?: string;
  
  // The user or entity that created/owns the intent (e.g., POS terminal or Waiter)
  creatorSubjectId: string;
  
  // The user who is paying (e.g., Rabbiter scanning the QR)
  payerSubjectId?: string;

  amountMxn: number;
  bunzAmount: number;
  currency: string;
  
  status: PaymentIntentStatus;
  
  idempotencyKey: string;
  
  expiresAt: Date;
  createdAt: Date;
  paidAt?: Date;
}

export class PaymentIntentService {
  static async createIntent(params: {
    tenantId: string;
    creatorSubjectId: string;
    amountMxn: number;
    orderId?: string;
    idempotencyKey: string;
  }): Promise<PaymentIntent> {
    const restaurantDb = getRestaurantDb();
    const bunzConversionRate = 1;
    const requiredBunz = params.amountMxn * bunzConversionRate;

    // Check Idempotency in DB
    const [existing] = await restaurantDb
      .select()
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.idempotencyKey, params.idempotencyKey),
          eq(paymentIntents.merchantId, params.tenantId)
        )
      )
      .limit(1);

    if (existing) {
      return {
        id: existing.id,
        tenantId: existing.merchantId,
        orderId: existing.orderId || undefined,
        creatorSubjectId: existing.creatorSubjectId || params.creatorSubjectId,
        payerSubjectId: existing.payerSubjectId || undefined,
        amountMxn: existing.amountMxn,
        bunzAmount: existing.bunzAmount,
        currency: existing.currency,
        status: existing.status as PaymentIntentStatus,
        idempotencyKey: existing.idempotencyKey || params.idempotencyKey,
        expiresAt: existing.expiresAt,
        createdAt: existing.createdAt || new Date(),
        paidAt: existing.paidAt || undefined,
      };
    }

    const intentId = `pi_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min TTL

    let inserted;
    try {
      const [row] = await restaurantDb
        .insert(paymentIntents)
        .values({
          id: intentId,
          orderId: params.orderId,
          merchantId: params.tenantId,
          creatorSubjectId: params.creatorSubjectId,
          amountMxn: params.amountMxn,
          bunzAmount: requiredBunz,
          currency: "MXN",
          status: "PENDING_PAYMENT",
          idempotencyKey: params.idempotencyKey,
          expiresAt,
        })
        .onConflictDoNothing({ target: paymentIntents.idempotencyKey })
        .returning();
      inserted = row;
    } catch {
      // In case of conflict fallback
    }

    if (!inserted) {
      const [winning] = await restaurantDb
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.idempotencyKey, params.idempotencyKey))
        .limit(1);

      if (winning) {
        return {
          id: winning.id,
          tenantId: winning.merchantId,
          orderId: winning.orderId || undefined,
          creatorSubjectId: winning.creatorSubjectId || params.creatorSubjectId,
          payerSubjectId: winning.payerSubjectId || undefined,
          amountMxn: winning.amountMxn,
          bunzAmount: winning.bunzAmount,
          currency: winning.currency,
          status: winning.status as PaymentIntentStatus,
          idempotencyKey: winning.idempotencyKey || params.idempotencyKey,
          expiresAt: winning.expiresAt,
          createdAt: winning.createdAt || new Date(),
          paidAt: winning.paidAt || undefined,
        };
      }
      throw new Error("FAILED_TO_CREATE_INTENT");
    }

    return {
      id: inserted.id,
      tenantId: inserted.merchantId,
      orderId: inserted.orderId || undefined,
      creatorSubjectId: inserted.creatorSubjectId || params.creatorSubjectId,
      payerSubjectId: inserted.payerSubjectId || undefined,
      amountMxn: inserted.amountMxn,
      bunzAmount: inserted.bunzAmount,
      currency: inserted.currency,
      status: inserted.status as PaymentIntentStatus,
      idempotencyKey: inserted.idempotencyKey || params.idempotencyKey,
      expiresAt: inserted.expiresAt,
      createdAt: inserted.createdAt || new Date(),
      paidAt: inserted.paidAt || undefined,
    };
  }

  static async getIntent(intentId: string): Promise<PaymentIntent | null> {
    const restaurantDb = getRestaurantDb();
    const [intent] = await restaurantDb
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, intentId))
      .limit(1);

    if (!intent) return null;

    // Check expiration
    if (intent.status === "PENDING_PAYMENT" && new Date() > intent.expiresAt) {
      await restaurantDb
        .update(paymentIntents)
        .set({ status: "EXPIRED" })
        .where(eq(paymentIntents.id, intent.id));
      intent.status = "EXPIRED";
    }

    return {
      id: intent.id,
      tenantId: intent.merchantId,
      orderId: intent.orderId || undefined,
      creatorSubjectId: intent.creatorSubjectId || "system",
      payerSubjectId: intent.payerSubjectId || undefined,
      amountMxn: intent.amountMxn,
      bunzAmount: intent.bunzAmount,
      currency: intent.currency,
      status: intent.status as PaymentIntentStatus,
      idempotencyKey: intent.idempotencyKey || "",
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt || new Date(),
      paidAt: intent.paidAt || undefined,
    };
  }

  /**
   * Approves AND Settles the Payment Intent atomically in a SINGLE SQL transaction.
   * Enforces pessimistic row locks (FOR UPDATE) to prevent concurrency races.
   */
  static async approveIntent(intentId: string, payerSubjectId: string): Promise<PaymentIntent> {
    if (!payerSubjectId || payerSubjectId === "SYSTEM") {
      throw new Error("PAYER_REQUIRED_FOR_SETTLEMENT");
    }

    const restaurantDb = getRestaurantDb();

    const settled: PaymentIntent = await restaurantDb.transaction(async (tx: any) => {
      // 1. Pessimistic Row Lock on Intent (prevents double approval race condition)
      const [intent] = await tx
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, intentId))
        .for("update");

      if (!intent) throw new Error("INTENT_NOT_FOUND");

      if (intent.status === "SETTLED") {
        if (intent.payerSubjectId === payerSubjectId) {
          return {
            id: intent.id,
            tenantId: intent.merchantId,
            orderId: intent.orderId || undefined,
            creatorSubjectId: intent.creatorSubjectId || "system",
            payerSubjectId: intent.payerSubjectId || undefined,
            amountMxn: intent.amountMxn,
            bunzAmount: intent.bunzAmount,
            currency: intent.currency,
            status: "SETTLED",
            idempotencyKey: intent.idempotencyKey || "",
            expiresAt: intent.expiresAt,
            createdAt: intent.createdAt || new Date(),
            paidAt: intent.paidAt || undefined,
          };
        }
        throw new Error("INTENT_ALREADY_SETTLED_BY_OTHER");
      }

      if (intent.status !== "PENDING_PAYMENT" && intent.status !== "CREATED") {
        throw new Error(`INVALID_STATE_TRANSITION: Cannot approve intent in status ${intent.status}`);
      }

      if (new Date() > intent.expiresAt) {
        await tx
          .update(paymentIntents)
          .set({ status: "EXPIRED" })
          .where(eq(paymentIntents.id, intent.id));
        throw new Error("INTENT_EXPIRED");
      }

      // 2. Pessimistic Row Lock & Balance Verification on Payer (within SAME transaction)
      const [payerUser] = await tx
        .select()
        .from(users)
        .where(eq(users.telegramId, payerSubjectId))
        .for("update");

      if (!payerUser) {
        throw new Error("USER_NOT_FOUND");
      }

      const availableBalance = (payerUser.totalBunzEarned ?? 0) - (payerUser.totalBunzSpent ?? 0);
      if (availableBalance < intent.bunzAmount) {
        throw new Error("LEDGER_INSUFFICIENT_FUNDS");
      }

      const requiredBunzInt = Math.floor(intent.bunzAmount);

      // 3. Atomic Debit on users table (within SAME transaction)
      // D-13 · patrón condicional atómico (U2/U10): la condición de saldo vive
      // en el WHERE, no en la comparación previa. Sin fila devuelta el débito no
      // se aplica y la transacción entera se revierte.
      const debited = await tx
        .update(users)
        .set({ totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${requiredBunzInt}` })
        .where(
          and(
            eq(users.id, payerUser.id),
            sql`COALESCE(${users.totalBunzEarned}, 0) - COALESCE(${users.totalBunzSpent}, 0) >= ${requiredBunzInt}`
          )
        )
        .returning({ id: users.id });

      if (debited.length === 0) {
        throw new Error("LEDGER_INSUFFICIENT_FUNDS");
      }

      // 4. Insert Ledger Entry (within SAME transaction)
      const [insertedLedger] = await tx
        .insert(ledgerEntries)
        .values({
          branchId: intent.merchantId,
          payerSubjectId,
          payeeSubjectId: intent.merchantId,
          amount: intent.bunzAmount,
          currency: "BUNZ",
          type: "SPEND",
          referenceId: intent.id,
          idempotencyKey: `stl_${intent.idempotencyKey || intent.id}`,
          metadata: { orderId: intent.orderId, amountMxn: intent.amountMxn },
        })
        .returning();

      // 5. Process Dynamic Fund Allocation Rules (Distribution Engine in MXN)
      if (intent.merchantId) {
        const activeRules = await tx
          .select()
          .from(distributionRules)
          .where(
            and(
              eq(distributionRules.branchId, intent.merchantId),
              eq(distributionRules.isActive, true)
            )
          );

        for (const rule of activeRules) {
          // Calculate allocation based on amountMxn (fiat sale value), not bunz amount
          const allocationAmount =
            rule.allocationType === "PERCENTAGE"
              ? (intent.amountMxn * rule.allocationValue) / 100
              : rule.allocationValue;

          if (allocationAmount > 0) {
            const [allocation] = await tx
              .insert(distributionAllocations)
              .values({
                paymentIntentId: intent.id,
                orderId: intent.orderId,
                branchId: intent.merchantId,
                ruleId: rule.id,
                destinationId: rule.destinationId,
                amountMxn: allocationAmount,
                status: "ALLOCATED",
              })
              .returning();

            // Register Pending External/Internal Settlement Obligation
            await tx.insert(settlementOperations).values({
              allocationId: allocation.id,
              ledgerEntryId: insertedLedger.id,
              destinationId: rule.destinationId,
              amount: allocationAmount,
              currency: "MXN",
              provider: "INTERNAL",
              status: "PENDING",
            });
          }
        }
      }

      // 6. Cashback OFICIAL — SOLO sobre la parte FIAT de la venta.
      // Regla económica (decisión D-10, 2026-11-02): el cashback se gana al
      // comprar con fiat a los afiliados; pagar CON Bunz no genera Bunz
      // (fiatMxn = amountMxn − bunzAmount; venta 100% Bunz ⇒ 0 cashback).
      if (payerSubjectId && payerSubjectId !== "SYSTEM") {
        // Tasa real del negocio (branch → restaurant.defaultRewardRate); 20 solo como fallback
        let cashbackRate = 20;
        try {
          const [br] = await tx.select({ restaurantId: branches.restaurantId })
            .from(branches).where(eq(branches.id, intent.merchantId)).limit(1);
          if (br?.restaurantId) {
            const [rest] = await tx.select({ defaultRewardRate: restaurants.defaultRewardRate })
              .from(restaurants).where(eq(restaurants.id, br.restaurantId)).limit(1);
            if (rest?.defaultRewardRate) cashbackRate = rest.defaultRewardRate;
          }
        } catch (rateErr) {
          console.error("[intent.settle] Error resolviendo rewardRate, fallback 20%:", rateErr);
        }
        const fiatMxn = Math.max(0, Number(intent.amountMxn || 0) - Number(intent.bunzAmount || 0));
        const rewardAmount = Math.floor(fiatMxn * (cashbackRate / 100));
        if (fiatMxn > 0 && rewardAmount > 0) {
          await tx
            .update(users)
            .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${rewardAmount}` })
            .where(eq(users.telegramId, payerSubjectId));

          await tx.insert(ledgerEntries).values({
            branchId: intent.merchantId,
            payerSubjectId: intent.merchantId || "SYSTEM",
            payeeSubjectId: payerSubjectId,
            amount: rewardAmount,
            currency: "BUNZ",
            type: "EARN",
            referenceId: intent.id,
            idempotencyKey: `cbk_${intent.id}_${payerSubjectId}`,
            metadata: { orderId: intent.orderId, amountMxn: intent.amountMxn, reason: "CASHBACK_PAYMENT" },
          });
        }
      }

      // 7. Mark intent SETTLED and update orders + payments (within SAME transaction)
      const paidAt = new Date();
      await tx
        .update(paymentIntents)
        .set({
          status: "SETTLED",
          payerSubjectId,
          paidAt,
        })
        .where(eq(paymentIntents.id, intent.id));

      if (intent.orderId) {
        await tx.insert(payments).values({
          orderId: intent.orderId,
          method: "BUNZ",
          amount: intent.amountMxn,
          reference: intent.id,
          status: "COMPLETED",
          verificationMethod: "SYSTEM_VERIFIED",
        });

        // H16-2 partial set: la orden solo marca COMPLETED cuando el total pagado
        // (todas las payments COMPLETED de la orden) cubre el total de la orden.
        // Si quedó resto, la orden queda PENDING (como tab) y el POS cobra el
        // resto en fiat (el watcher/H14-Watch del POS lo ve como payment row).
        const [orderRow] = await tx
          .select({ total: orders.total })
          .from(orders)
          .where(eq(orders.id, intent.orderId))
          .limit(1);
        const paidSoFarRows = (await tx
          .select({ sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
          .from(payments)
          .where(and(eq(payments.orderId, intent.orderId), eq(payments.status, "COMPLETED")))) as Array<{ sum: number }>;
        const paidSoFar = Number(paidSoFarRows?.[0]?.sum ?? 0);
        const totalOrder = Number(orderRow?.total || 0);
        const fullyPaid = totalOrder > 0 ? paidSoFar + 0.005 >= totalOrder : true;
        await tx
          .update(orders)
          .set(
            fullyPaid
              ? { status: "COMPLETED", bunzPaid: requiredBunzInt }
              : { bunzPaid: requiredBunzInt }
          )
          .where(eq(orders.id, intent.orderId));
      }

      // ── D-13 · Patrón condicional atómico (modelo §3) ──
      // `bunzBalance` = capacidad de redención RESPALDADA y DISPONIBLE del
      // afiliado. Al pagar con Bunz la oferta se cumple y el respaldo SE CONSUME
      // (los Bunz no "van" a una cuenta del negocio; emisión ≠ tesorería).
      //
      // Regla económica: sin disponibilidad suficiente la redención NO puede
      // completarse. La condición vive en el WHERE (atómico, sin check-then-act)
      // y si no devuelve fila se revierte TODA la transacción — incluido el
      // débito del Rabbitter y el SETTLED del intent. `GREATEST(0)` queda solo
      // como protección secundaria de escritura, jamás como regla de negocio.
      //
      // Va fuera de `if (intent.orderId)` a propósito: un cobro con Bunz sin
      // orden asociada (bill-bunz-pay) también consume respaldo.
      const bunzToConsume = Math.floor(Number(intent.bunzAmount || 0));
      if (bunzToConsume > 0) {
        const [bn] = await tx
          .select({ restaurantId: branches.restaurantId })
          .from(branches)
          .where(eq(branches.id, intent.merchantId))
          .limit(1);
        const [rest] = bn?.restaurantId
          ? await tx
              .select({ businessId: restaurants.businessId })
              .from(restaurants)
              .where(eq(restaurants.id, bn.restaurantId))
              .limit(1)
          : [];

        if (!rest?.businessId) {
          throw new Error("BUNZ_BACKING_UNRESOLVED");
        }

        const consumed = await tx
          .update(ownedBusinesses)
          .set({ bunzBalance: sql`GREATEST(0, COALESCE("bunzBalance", 0) - ${bunzToConsume})` })
          .where(
            and(
              eq(ownedBusinesses.id, rest.businessId),
              sql`COALESCE("bunzBalance", 0) >= ${bunzToConsume}`
            )
          )
          .returning({ remaining: ownedBusinesses.bunzBalance });

        if (consumed.length === 0) {
          throw new Error("BUNZ_BACKING_INSUFFICIENT");
        }
      }

      return {
        id: intent.id,
        tenantId: intent.merchantId,
        orderId: intent.orderId || undefined,
        creatorSubjectId: intent.creatorSubjectId || "system",
        payerSubjectId,
        amountMxn: intent.amountMxn,
        bunzAmount: intent.bunzAmount,
        currency: intent.currency,
        status: "SETTLED",
        idempotencyKey: intent.idempotencyKey || "",
        expiresAt: intent.expiresAt,
        createdAt: intent.createdAt || new Date(),
        paidAt,
      };
    });

    // ── RP-0.3: snapshot shadow (read-only, no altera nada) ─────────────
    try {
      if (settled.orderId) {
        const [order] = await restaurantDb
          .select()
          .from(orders)
          .where(eq(orders.id, settled.orderId))
          .limit(1);
        const paymentRows = await restaurantDb
          .select()
          .from(payments)
          .where(eq(payments.orderId, settled.orderId));

        if (order) {
          const report = buildShadowReport({
            order: {
              id: order.id,
              branchId: order.branchId,
              total: Number(order.total || 0),
              status: String(order.status || ""),
              bunzPaid: order.bunzPaid,
            },
            payments: (paymentRows as Array<Record<string, unknown>>).map((p) => ({
              id: String(p.id),
              orderId: p.orderId ? String(p.orderId) : undefined,
              amount: Number(p.amount || 0),
              method: String(p.method || ""),
              status: String(p.status || ""),
              reference: p.reference ? String(p.reference) : undefined,
              tipAmount: p.tipAmount ? Number(p.tipAmount) : undefined,
              verificationMethod: p.verificationMethod ? String(p.verificationMethod) : undefined,
            })),
            intent: {
              id: settled.id,
              orderId: settled.orderId,
              merchantId: settled.tenantId,
              status: "SETTLED",
              amountCents: Math.round(Number(settled.amountMxn || 0) * 100),
              netFiatCents: 0,
              bunzAmount: Number(settled.bunzAmount || 0),
              currency: settled.currency,
            },
          });
          recordShadowReport(report);
        }
      }
    } catch (shadowErr) {
      console.warn("[SHADOW_PAYMENT] dominio: no se pudo registrar el snapshot:", shadowErr);
    }

    return settled;
  }
}

