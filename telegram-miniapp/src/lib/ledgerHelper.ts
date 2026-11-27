import { db } from "@/db";
import { ledgerEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeLedgerSubject } from "@rabbitty/api/services/ledgerSubjects";

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
  /**
   * true = asiento de prueba/demo (orden `isTest` o negocio sandbox). No entra
   * al ancla y no consume `seq`; el trigger de la base lo deja con seq = NULL.
   */
  sandbox?: boolean;
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
      // Defensa final: la base rechaza sujetos no canónicos y tumba la operación
      // completa. Se normaliza aquí (alias de sistema) y se falla claro si es un
      // UUID sin prefijo, en vez de dejar un 500 opaco.
      payerSubjectId: normalizeLedgerSubject(params.payerSubjectId),
      payeeSubjectId: normalizeLedgerSubject(params.payeeSubjectId),
      amount: Math.round(params.amount),
      currency: "BUNZ",
      type: params.type,
      referenceId: params.referenceId || undefined,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata || null,
      sandbox: params.sandbox === true,
    })
    .onConflictDoNothing({ target: ledgerEntries.idempotencyKey })
    .returning();

  if (entry) return entry;

  return findLedgerEntry(params.idempotencyKey, tx);
}
