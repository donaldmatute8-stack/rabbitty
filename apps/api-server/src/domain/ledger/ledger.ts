import { eq, and, sql } from "drizzle-orm";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api";
import { 
  ledgerEntries, 
  distributionRules, 
  distributionAllocations, 
  settlementOperations 
} from "@rabbitty/database-restaurant";
import { users } from "@rabbitty/database-core";

export type TransactionType = "EARN" | "SPEND" | "TRANSFER" | "MINT" | "BURN" | "REFUND" | "ALLOCATION";

export interface LedgerEntry {
  id: string;
  tenantId?: string;
  
  payerSubjectId: string; // The origin wallet/user/tenant
  payeeSubjectId: string; // The destination wallet/user/tenant
  
  amount: number;
  currency?: string;
  type: TransactionType;
  
  referenceId?: string; // e.g. PaymentIntent ID
  idempotencyKey: string;
  
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * The Ledger is the ultimate authority on Bunz balances and movements.
 * It operates strictly on the server-side, isolated from the clients.
 */
export class LedgerService {
  /**
   * Records an atomic transaction in the Internal Ledger via Drizzle SQL Transactions.
   */
  static async recordTransaction(entry: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry> {
    const restaurantDb = getRestaurantDb();
    const coreDb = getCoreDb();

    // 1. Idempotency Check
    const [existing] = await restaurantDb
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, entry.idempotencyKey))
      .limit(1);

    if (existing) {
      if (existing.payerSubjectId !== entry.payerSubjectId || existing.amount !== entry.amount) {
        throw new Error("IDEMPOTENCY_CONFLICT: Key reused with different parameters");
      }
      return {
        id: existing.id,
        tenantId: existing.branchId || undefined,
        payerSubjectId: existing.payerSubjectId,
        payeeSubjectId: existing.payeeSubjectId,
        amount: existing.amount,
        currency: existing.currency,
        type: existing.type as TransactionType,
        referenceId: existing.referenceId || undefined,
        idempotencyKey: existing.idempotencyKey,
        createdAt: existing.createdAt || new Date(),
        metadata: (existing.metadata as Record<string, any>) || undefined,
      };
    }

    // 2. Atomic SQL Transaction
    const createdEntry = await restaurantDb.transaction(async (tx) => {
      // Balance verification and debit for spenders (within SAME transaction)
      if (entry.type === "SPEND" && entry.payerSubjectId !== "SYSTEM") {
        const [payerUser] = await tx
          .select()
          .from(users)
          .where(eq(users.telegramId, entry.payerSubjectId))
          .for("update");

        if (payerUser) {
          const available = Math.max(0, (payerUser.totalBunzEarned ?? 0) - (payerUser.totalBunzSpent ?? 0));
          if (available < entry.amount) {
            throw new Error("LEDGER_INSUFFICIENT_FUNDS");
          }

          const requiredBunzInt = Math.floor(entry.amount);
          await tx
            .update(users)
            .set({ totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${requiredBunzInt}` })
            .where(eq(users.id, payerUser.id));
        }
      } else if (entry.type === "EARN") {
        // Atomic credit in same transaction
        const [payeeUser] = await tx
          .select()
          .from(users)
          .where(eq(users.telegramId, entry.payeeSubjectId))
          .for("update");

        if (payeeUser) {
          const earnBunzInt = Math.floor(entry.amount);
          await tx
            .update(users)
            .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${earnBunzInt}` })
            .where(eq(users.id, payeeUser.id));
        }
      }

      // Insert Ledger Entry
      const [insertedLedger] = await tx
        .insert(ledgerEntries)
        .values({
          branchId: entry.tenantId,
          payerSubjectId: entry.payerSubjectId,
          payeeSubjectId: entry.payeeSubjectId,
          amount: entry.amount,
          currency: entry.currency || "BUNZ",
          type: entry.type,
          referenceId: entry.referenceId,
          idempotencyKey: entry.idempotencyKey,
          metadata: entry.metadata,
        })
        .returning();

      // 3. Process Dynamic Fund Allocation Rules (Distribution Engine in MXN)
      if (entry.tenantId && entry.metadata?.amountMxn && entry.type === "SPEND") {
        const fiatMxn = Number(entry.metadata.amountMxn);
        const activeRules = await tx
          .select()
          .from(distributionRules)
          .where(
            and(
              eq(distributionRules.branchId, entry.tenantId),
              eq(distributionRules.isActive, true)
            )
          );

        for (const rule of activeRules) {
          const allocationAmount =
            rule.allocationType === "PERCENTAGE"
              ? (fiatMxn * rule.allocationValue) / 100
              : rule.allocationValue;

          if (allocationAmount > 0) {
            const [allocation] = await tx
              .insert(distributionAllocations)
              .values({
                paymentIntentId: entry.referenceId,
                branchId: entry.tenantId,
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

      return {
        id: insertedLedger.id,
        tenantId: insertedLedger.branchId || undefined,
        payerSubjectId: insertedLedger.payerSubjectId,
        payeeSubjectId: insertedLedger.payeeSubjectId,
        amount: insertedLedger.amount,
        currency: insertedLedger.currency,
        type: insertedLedger.type as TransactionType,
        referenceId: insertedLedger.referenceId || undefined,
        idempotencyKey: insertedLedger.idempotencyKey,
        createdAt: insertedLedger.createdAt || new Date(),
        metadata: (insertedLedger.metadata as Record<string, any>) || undefined,
      };
    });

    // 4. Asynchronous Settlement Initiation (AFTER COMMIT - Isolated from SQL Transaction)
    import("../settlement/service").then(({ SettlementService }) => {
      SettlementService.initiateSettlement({
        tenantId: createdEntry.tenantId || "SYSTEM",
        ledgerEntryId: createdEntry.id,
        amount: createdEntry.amount,
        asset: createdEntry.currency || "BUNZ",
        originSubjectId: createdEntry.payerSubjectId,
        destinationSubjectId: createdEntry.payeeSubjectId,
        idempotencyKey: `stl_trigger_${createdEntry.id}`,
      }).catch(console.error);
    }).catch(console.error);

    return createdEntry;
  }

  /**
   * Retrieves authoritative balance for a subject (User or Tenant).
   */
  static async getAvailableBalance(subjectId: string): Promise<number> {
    const coreDb = getCoreDb();
    const [user] = await coreDb
      .select()
      .from(users)
      .where(eq(users.telegramId, subjectId))
      .limit(1);

    if (user) {
      return Math.max(0, (user.totalBunzEarned ?? 0) - (user.totalBunzSpent ?? 0));
    }

    const restaurantDb = getRestaurantDb();
    const entries = await restaurantDb
      .select()
      .from(ledgerEntries)
      .where(
        sql`${ledgerEntries.payerSubjectId} = ${subjectId} OR ${ledgerEntries.payeeSubjectId} = ${subjectId}`
      );

    const credits = entries
      .filter((e) => e.payeeSubjectId === subjectId)
      .reduce((sum, e) => sum + e.amount, 0);

    const debits = entries
      .filter((e) => e.payerSubjectId === subjectId)
      .reduce((sum, e) => sum + e.amount, 0);

    return credits - debits;
  }
}

