import { db } from "@/db";
import { users, ledgerEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface RecordTransactionParams {
  branchId?: string | null;
  payerSubjectId: string;
  payeeSubjectId: string;
  amount: number;
  type: "EARN" | "SPEND" | "TRANSFER" | "MINT" | "BURN" | "REFUND" | "ALLOCATION";
  referenceId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

/**
 * Records a transaction in the authoritative Ledger table (`ledger_entries`)
 * ensuring complete auditability and consistency across all operations.
 */
export async function recordLedgerTransaction(params: RecordTransactionParams, tx?: any) {
  const executor = tx || db;

  // 1. Idempotency check
  const [existing] = await executor
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.idempotencyKey, params.idempotencyKey))
    .limit(1);

  if (existing) {
    return existing;
  }

  // 2. Insert into ledger_entries
  const [entry] = await executor
    .insert(ledgerEntries)
    .values({
      branchId: params.branchId || undefined,
      payerSubjectId: params.payerSubjectId,
      payeeSubjectId: params.payeeSubjectId,
      amount: params.amount,
      currency: "BUNZ",
      type: params.type,
      referenceId: params.referenceId || undefined,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata || null,
    })
    .returning();

  return entry;
}
