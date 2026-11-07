/**
 * ── OT-2: obligaciones por comisión (devengo → mora → liquidación) ───────────
 *
 * Al cobrar una orden se devenga la comisión del afiliado (6% por defecto, igual
 * que el modelo). La obligación nace OPEN y vence a los 15 días.
 *
 * Ciclo de vida:
 *   NEW → OPEN → (LATE) → PARTIAL → SETTLED
 *
 * Reglas:
 *  - El devengo NO mueve dinero: es deuda. Detrás de `RABBITTY_BUNZ_OBLIGATIONS`.
 *  - La mora es solo un cambio de estado (cron diario), no toca saldos.
 *  - La liquidación mueve Bunz y por eso está detrás de `RABBITTY_BUNZ_SETTLE`
 *    (apagado por defecto): depende de G3/G4 y de RP-2.
 *  - Todo es idempotente por ids deterministas.
 */

import { and, eq, lte } from "drizzle-orm";
import { recordSettlementBooks } from "./bunzBooks";

export const OBLIGATION_FLAG = "RABBITTY_BUNZ_OBLIGATIONS";
export const SETTLEMENT_FLAG = "RABBITTY_BUNZ_SETTLE";
export const COMMISSION_RATE = 0.06;
export const DUE_DAYS = 15;

export const OBLIGATION_STATES = ["OPEN", "LATE", "PARTIAL", "SETTLED", "WRITTEN_OFF"] as const;
export type ObligationState = (typeof OBLIGATION_STATES)[number];

function asBool(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "TRUE";
}

export function isObligationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return asBool(env[OBLIGATION_FLAG]);
}

/** La liquidación es una acción económica: apagada salvo autorización explícita. */
export function isSettlementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return asBool(env[SETTLEMENT_FLAG]);
}

export function buildObligation({
  orderId,
  affiliateId,
  fiatAmount,
  rate = COMMISSION_RATE,
  dueDays = DUE_DAYS,
  at = new Date(),
}: {
  orderId: string;
  affiliateId: string;
  fiatAmount: number;
  rate?: number;
  dueDays?: number;
  at?: Date;
}) {
  const amount = Math.round(Number(fiatAmount) * rate * 100) / 100;
  if (!(amount > 0) || !affiliateId) return null;
  return {
    id: `ob-${orderId}`,
    affiliateId,
    origin: "fiat_sale",
    accruedAt: at,
    dueAt: new Date(at.getTime() + dueDays * 86_400_000),
    amountBunz: amount,
    state: "OPEN" as ObligationState,
    settledBunz: 0,
    settledFiatMxn: 0,
  };
}

type Insertable = {
  insert: (table: any) => {
    values: (rows: any) => { onConflictDoNothing: () => Promise<unknown> };
  };
  transaction: <T>(fn: (sp: any) => Promise<T>) => Promise<T>;
};

type ObligationDb = Insertable & {
  select: (cols?: any) => any;
  update: (table: any) => any;
};

const cents = (n: number) => Math.round((Number(n) || 0) * 100);

/** Devenga la obligación. No lanza: si falla, el cobro sigue. */
export async function accrueCommission(
  tx: Insertable,
  {
    orderId,
    affiliateId,
    fiatAmount,
    at = new Date(),
    tables,
  }: {
    orderId: string;
    affiliateId: string;
    fiatAmount: number;
    at?: Date;
    tables: { obligations: unknown; events: unknown };
  }
): Promise<{ ok: boolean; errors: string[] }> {
  if (!isObligationsEnabled()) return { ok: true, errors: [] };
  const row = buildObligation({ orderId, affiliateId, fiatAmount, at });
  if (!row) return { ok: true, errors: [] };

  try {
    await tx.transaction(async (sp) => {
      await sp.insert(tables.obligations).values(row).onConflictDoNothing();
      await sp
        .insert(tables.events)
        .values({
          id: `obe-${orderId}`,
          obligationId: row.id,
          at: row.accruedAt,
          fromState: "NEW",
          toState: "OPEN",
          actor: "system",
          note: "devengo comisión fiat_sale",
        })
        .onConflictDoNothing();
    });
    return { ok: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzObligations] devengo ${orderId} no registrado (no fatal): ${msg}`);
    return { ok: false, errors: [msg] };
  }
}

/**
 * Marca como LATE las obligaciones OPEN vencidas. Solo estado, no dinero.
 * Idempotente: el evento `obe-late-<id>` se inserta con onConflictDoNothing.
 */
export async function markOverdue(
  db: ObligationDb,
  {
    now = new Date(),
    tables,
  }: { now?: Date; tables: { obligations: unknown; events: unknown } }
): Promise<{ ok: boolean; marked: number; errors: string[] }> {
  if (!isObligationsEnabled()) return { ok: true, marked: 0, errors: [] };

  try {
    const rows = await db
      .select()
      .from(tables.obligations)
      .where(and(eq((tables.obligations as any).state, "OPEN"), lte((tables.obligations as any).dueAt, now)));

    let marked = 0;
    for (const row of rows as any[]) {
      try {
        await db.transaction(async (sp) => {
          await sp
            .update(tables.obligations)
            .set({ state: "LATE" })
            .where(eq((tables.obligations as any).id, row.id));
          await sp
            .insert(tables.events)
            .values({
              id: `obe-late-${row.id}`,
              obligationId: row.id,
              at: now,
              fromState: "OPEN",
              toState: "LATE",
              actor: "system",
              note: "vencimiento automático",
            })
            .onConflictDoNothing();
        });
        marked++;
      } catch (e) {
        console.warn(`[bunzObligations] mora ${row.id} no marcada: ${e instanceof Error ? e.message : e}`);
      }
    }
    return { ok: true, marked, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzObligations] barrido de mora falló (no fatal): ${msg}`);
    return { ok: false, marked: 0, errors: [msg] };
  }
}

export type SettlementResult = {
  ok: boolean;
  skipped?: boolean;
  state?: ObligationState;
  settledBunz?: number;
  errors: string[];
};

/**
 * Liquida (total o parcialmente) una obligación en Bunz.
 *
 * Requiere `RABBITTY_BUNZ_SETTLE`. Escribe el asiento de liquidación con
 * `recordSettlementBooks` y la transición de estado en la misma transacción.
 * No lanza: devuelve el error.
 */
export async function settleObligation(
  db: ObligationDb,
  {
    obligationId,
    bunz,
    fiatMxn = 0,
    actor = "god_admin",
    instrument = "bunz",
    at = new Date(),
    tables,
  }: {
    obligationId: string;
    bunz: number;
    fiatMxn?: number;
    actor?: string;
    instrument?: string;
    at?: Date;
    tables: { obligations: unknown; events: unknown; ledger: unknown };
  }
): Promise<SettlementResult> {
  if (!isSettlementEnabled()) {
    return { ok: false, skipped: true, errors: ["RABBITTY_BUNZ_SETTLE apagado"] };
  }
  if (!(Number(bunz) > 0)) return { ok: false, errors: ["importe de liquidación inválido"] };

  try {
    return await db.transaction(async (sp) => {
      const [row] = (await sp
        .select()
        .from(tables.obligations)
        .where(eq((tables.obligations as any).id, obligationId))) as any[];

      if (!row) return { ok: false, errors: [`obligación ${obligationId} no existe`] };
      if (row.state === "SETTLED" || row.state === "WRITTEN_OFF") {
        return { ok: false, state: row.state, errors: [`obligación ya ${row.state}`] };
      }

      const remaining = Math.max(0, Number(row.amountBunz) - Number(row.settledBunz));
      const amount = Math.min(Number(bunz), remaining);
      if (!(amount > 0)) return { ok: false, state: row.state, errors: ["nada por liquidar"] };

      const newSettled = Math.round((Number(row.settledBunz) + amount) * 100) / 100;
      const fully = cents(newSettled) >= cents(row.amountBunz);
      const state: ObligationState = fully ? "SETTLED" : "PARTIAL";
      const seq = cents(newSettled);

      await sp
        .update(tables.obligations)
        .set({
          state,
          settledBunz: newSettled,
          settledFiatMxn: Math.round((Number(row.settledFiatMxn) + Number(fiatMxn || 0)) * 100) / 100,
          settledAt: fully ? at : row.settledAt ?? null,
          instrument,
        })
        .where(eq((tables.obligations as any).id, obligationId));

      await sp
        .insert(tables.events)
        .values({
          id: `obe-settle-${obligationId}-${seq}`,
          obligationId,
          at,
          fromState: row.state,
          toState: state,
          actor,
          note: `liquidación ${amount} Bunz`,
        })
        .onConflictDoNothing();

      await recordSettlementBooks(sp, {
        obligationId,
        bunz: amount,
        at,
        seq,
        tables: { ledger: tables.ledger },
      });

      return { ok: true, state, settledBunz: newSettled, errors: [] };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzObligations] liquidación ${obligationId} falló: ${msg}`);
    return { ok: false, errors: [msg] };
  }
}
