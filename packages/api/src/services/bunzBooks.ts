/**
 * ── Escritores del libro Bunz (OT-3) y de intentos (OT-1) ───────────────────
 *
 * Reglas:
 *  - Idempotente: ids deterministas + `onConflictDoNothing`.
 *  - **Nunca rompe el pago**: cualquier error se registra y se devuelve, no se lanza.
 *  - Detrás de flag `RABBITTY_BUNZ_BOOKS` (apagado por defecto).
 *  - Solo escribe lo que **no depende de G3**: emisión y redención. La liquidación
 *    de obligaciones en Bunz espera a la decisión G3.
 */

import crypto from "node:crypto";

export const BOOKS_FLAG = "RABBITTY_BUNZ_BOOKS";

/** Catálogo cerrado de motivos (contrato v1.0). */
export const REDEMPTION_REASONS = [
  "capacity_exhausted",
  "out_of_stock",
  "affiliate_refused",
  "closed",
  "inactive_branch",
  "tech_failure",
  "user_cancelled",
  "duplicate",
  "fraud",
  "unknown",
] as const;

export function isBooksEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env[BOOKS_FLAG];
  return v === "1" || v === "true" || v === "TRUE";
}

/** Hash estable de un identificador de usuario; nunca se guarda el original. */
export function hashUser(value: string | null | undefined): string {
  if (!value) return "walkin";
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

/**
 * Asientos de una redención: el usuario gasta Bunz y se consume capacidad.
 * Grupo `rd-<orderId>`, balanceado por construcción.
 */
export function buildRedemptionLedger({ orderId, bunz, at = new Date() }: { orderId: string; bunz: number; at?: Date }) {
  const amount = Number(bunz) || 0;
  if (amount <= 0) return [];
  return [
    {
      id: `rd-${orderId}-d`,
      groupId: `rd-${orderId}`,
      ts: at,
      account: "user_wallet",
      direction: "debit",
      amount,
      refType: "redemption",
      refId: orderId,
    },
    {
      id: `rd-${orderId}-c`,
      groupId: `rd-${orderId}`,
      ts: at,
      account: "redemption_capacity",
      direction: "credit",
      amount,
      refType: "redemption",
      refId: orderId,
    },
  ];
}

/** Asientos de una emisión de recompensa (no cableado aún: depende de cuándo se considera emitida). */
export function buildEmissionLedger({ orderId, bunz, at = new Date() }: { orderId: string; bunz: number; at?: Date }) {
  const amount = Number(bunz) || 0;
  if (amount <= 0) return [];
  return [
    {
      id: `em-${orderId}-d`,
      groupId: `em-${orderId}`,
      ts: at,
      account: "emission_budget",
      direction: "debit",
      amount,
      refType: "reward",
      refId: orderId,
    },
    {
      id: `em-${orderId}-c`,
      groupId: `em-${orderId}`,
      ts: at,
      account: "user_wallet",
      direction: "credit",
      amount,
      refType: "reward",
      refId: orderId,
    },
  ];
}

/** Intento de redención cumplido (la tabla también guardará los rechazos cuando exista la UI). */
export function buildRedemptionAttempt({
  orderId,
  branchId,
  bunz,
  userHash,
  at = new Date(),
}: {
  orderId: string;
  branchId?: string | null;
  bunz: number;
  userHash?: string | null;
  at?: Date;
}) {
  const amount = Number(bunz) || 0;
  if (amount <= 0) return null;
  return {
    id: `rd-${orderId}`,
    userHash: hashUser(userHash),
    branchId: branchId ?? null,
    orderId,
    rewardId: null,
    requestedAt: at,
    bunzRequested: amount,
    bunzFulfilled: amount,
    status: "fulfilled",
    reasons: "[]",
    waitSeconds: 0,
    fulfilledAt: at,
    fulfilledBranchId: branchId ?? null,
    idempotencyKey: `rd-${orderId}`,
  };
}

/**
 * `tx` debe soportar `transaction()` para abrir un SAVEPOINT. Es imprescindible:
 * en Postgres un INSERT fallido aborta la transacción aunque se capture en JS.
 * Con savepoint, un fallo de observabilidad no tumba el pago.
 */
// Se tipa de forma laxa a propósito: el servicio no debe acoplarse al tipo
// genérico de Drizzle, solo a la forma de uso (insert/values/onConflictDoNothing).
type Insertable = {
  insert: (table: any) => {
    values: (rows: any) => { onConflictDoNothing: () => Promise<unknown> };
  };
  transaction: <T>(fn: (sp: any) => Promise<T>) => Promise<T>;
};

/**
 * Escribe intento + asientos de redención. No lanza: devuelve errores.
 * `tx` es la transacción de Drizzle; se tipa estructuralmente para no acoplar.
 */
export async function recordRedemptionBooks(
  tx: Insertable,
  { orderId, branchId, bunz, userHash, at = new Date(), tables }: {
    orderId: string;
    branchId?: string | null;
    bunz: number;
    userHash?: string | null;
    at?: Date;
    tables: {
      attempts: unknown;
      ledger: unknown;
    };
  }
): Promise<{ ok: boolean; errors: string[] }> {
  if (!isBooksEnabled()) return { ok: true, errors: [] };

  const attempt = buildRedemptionAttempt({ orderId, branchId, bunz, userHash, at });
  const entries = buildRedemptionLedger({ orderId, bunz, at });
  if (!attempt && !entries.length) return { ok: true, errors: [] };

  try {
    // Savepoint: si la tabla no existe o falla, se revierte solo esto.
    await tx.transaction(async (sp) => {
      if (attempt) {
        await sp.insert(tables.attempts).values(attempt).onConflictDoNothing();
      }
      if (entries.length) {
        await sp.insert(tables.ledger).values(entries).onConflictDoNothing();
      }
    });
    return { ok: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzBooks] redención ${orderId} no registrada (no fatal): ${msg}`);
    return { ok: false, errors: [msg] };
  }
}

/** Asientos de liquidación de una obligación en Bunz (G3=A: reclasificación interna). */
export function buildSettlementLedger({
  obligationId,
  bunz,
  at = new Date(),
  seq = 1,
}: {
  obligationId: string;
  bunz: number;
  at?: Date;
  seq?: number;
}) {
  const amount = Number(bunz) || 0;
  if (amount <= 0) return [];
  return [
    {
      id: `st-${obligationId}-${seq}-d`,
      groupId: `st-${obligationId}-${seq}`,
      ts: at,
      account: "commission_reserved",
      direction: "debit",
      amount,
      refType: "obligation",
      refId: obligationId,
    },
    {
      id: `st-${obligationId}-${seq}-c`,
      groupId: `st-${obligationId}-${seq}`,
      ts: at,
      account: "treasury_bunz",
      direction: "credit",
      amount,
      refType: "obligation",
      refId: obligationId,
    },
  ];
}

/** Escribe los asientos de emisión (recompensa emitida al cobrar). No lanza. */
export async function recordEmissionBooks(
  tx: Insertable,
  { orderId, bunz, at = new Date(), tables }: { orderId: string; bunz: number; at?: Date; tables: { ledger: unknown } }
): Promise<{ ok: boolean; errors: string[] }> {
  if (!isBooksEnabled()) return { ok: true, errors: [] };
  const entries = buildEmissionLedger({ orderId, bunz, at });
  if (!entries.length) return { ok: true, errors: [] };
  try {
    await tx.transaction(async (sp) => {
      await sp.insert(tables.ledger).values(entries).onConflictDoNothing();
    });
    return { ok: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzBooks] emisión ${orderId} no registrada (no fatal): ${msg}`);
    return { ok: false, errors: [msg] };
  }
}

/** Escribe los asientos de liquidación. No lanza. */
export async function recordSettlementBooks(
  tx: Insertable,
  {
    obligationId,
    bunz,
    at = new Date(),
    seq = 1,
    tables,
  }: {
    obligationId: string;
    bunz: number;
    at?: Date;
    seq?: number;
    tables: { ledger: unknown };
  }
): Promise<{ ok: boolean; errors: string[] }> {
  if (!isBooksEnabled()) return { ok: true, errors: [] };
  const entries = buildSettlementLedger({ obligationId, bunz, at, seq });
  if (!entries.length) return { ok: true, errors: [] };
  try {
    await tx.transaction(async (sp) => {
      await sp.insert(tables.ledger).values(entries).onConflictDoNothing();
    });
    return { ok: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzBooks] liquidación ${obligationId} no registrada (no fatal): ${msg}`);
    return { ok: false, errors: [msg] };
  }
}

/**
 * Reversión: invierte un grupo de asientos.
 * `rv-<id>` / `rv-<groupId>` para que sea idempotente y rastreable.
 */
export function buildReversalLedger({ original, at = new Date() }: { original: any[]; at?: Date }) {
  return original.map((e) => ({
    id: `rv-${e.id}`,
    groupId: `rv-${e.groupId}`,
    ts: at,
    account: e.account,
    direction: e.direction === "debit" ? "credit" : "debit",
    amount: Number(e.amount) || 0,
    refType: "reversal",
    refId: e.refId ?? null,
  }));
}

/** Escribe la reversión de los asientos dados. No lanza. */
export async function recordReversalBooks(
  tx: Insertable,
  { original, at = new Date(), tables }: { original: any[]; at?: Date; tables: { ledger: unknown } }
): Promise<{ ok: boolean; errors: string[] }> {
  if (!isBooksEnabled()) return { ok: true, errors: [] };
  const rows = buildReversalLedger({ original, at }).filter(
    (r) => original.every((o) => !String(o.id).startsWith("rv-")) // no revertir reversiones
  );
  if (!rows.length) return { ok: true, errors: [] };
  try {
    await tx.transaction(async (sp) => {
      await sp.insert(tables.ledger).values(rows).onConflictDoNothing();
    });
    return { ok: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzBooks] reversión no registrada (no fatal): ${msg}`);
    return { ok: false, errors: [msg] };
  }
}
