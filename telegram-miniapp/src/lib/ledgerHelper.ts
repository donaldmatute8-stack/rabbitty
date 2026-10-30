import { db } from "@/db";
import { ledgerEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecordTransactionParams {
  branchId?: string | null;
  payerSubjectId: string;
  payeeSubjectId: string;
  amount: number;
  type: "EARN" | "SPEND" | "TRANSFER" | "MINT" | "BURN" | "REFUND" | "ALLOCATION";
  referenceId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * Looks up an existing ledger entry by its idempotency key.
 * Used to short-circuit replays before mutating balances.
 */
export async function findLedgerEntry(idempotencyKey: string, tx?: Executor) {
  const executor = (tx || db) as typeof db;
  const [existing] = await executor
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.idempotencyKey, idempotencyKey))
    .limit(1);
  return existing ?? null;
}

/**
 * Records a transaction in the authoritative Ledger table (`ledger_entries`).
 * The insert is conflict-safe: a concurrent/replayed write with the same
 * idempotency key never produces a duplicate row (enforced by the unique
 * constraint on `idempotencyKey`); the existing entry is returned instead.
 */
export async function recordLedgerTransaction(params: RecordTransactionParams, tx?: Executor) {
  const executor = (tx || db) as typeof db;

  const [entry] = await executor
    .insert(ledgerEntries)
    .values({
      branchId: params.branchId || undefined,
      payerSubjectId: params.payerSubjectId,
      payeeSubjectId: params.payeeSubjectId,
      amount: Math.round(params.amount),
      currency: "BUNZ",
      type: params.type,
      referenceId: params.referenceId || undefined,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata || null,
    })
    .onConflictDoNothing({ target: ledgerEntries.idempotencyKey })
    .returning();

  if (entry) return entry;

  return findLedgerEntry(params.idempotencyKey, tx);
}
