/**
 * ── OT-2: obligaciones por comisión (devengo → mora → liquidación) ───────────
 *
 * Al cobrar una orden se devenga la comisión del afiliado (6% por defecto, igual
 * que el modelo). La obligación nace OPEN y vence a los 15 días.
 *
 * Ciclo de vida (estados del contrato v1.0):
 *   NEW → OPEN → PARTIALLY_PAID → PAID
 *   La mora NO es un estado: se deriva de `dueAt < now`.
 *
 * Reglas:
 *  - El devengo NO mueve dinero: es deuda. Detrás de `RABBITTY_BUNZ_OBLIGATIONS`.
 *  - La mora es solo un cambio de estado (cron diario), no toca saldos.
 *  - La liquidación mueve Bunz y por eso está detrás de `RABBITTY_BUNZ_SETTLE`
 *    (apagado por defecto): depende de G3/G4 y de RP-2.
 *  - Todo es idempotente por ids deterministas.
 */

import { and, eq, inArray, lte } from "drizzle-orm";
import { recordSettlementBooks } from "./bunzBooks";
import { checkOperation, isPilotMode } from "./bunzControls";

export const OBLIGATION_FLAG = "RABBITTY_BUNZ_OBLIGATIONS";
export const SETTLEMENT_FLAG = "RABBITTY_BUNZ_SETTLE";
/** Liquidación extinguiendo la obligación con fiat real (no mueve Bunz). */
export const FIAT_SETTLEMENT_FLAG = "RABBITTY_BUNZ_SETTLE_FIAT";
export const COMMISSION_RATE = 0.06;
export const DUE_DAYS = 15;

export const OBLIGATION_STATES = [
  "OPEN",
  "DISPUTED",
  "RESOLVED_PAYABLE",
  "PARTIALLY_PAID",
  "PAID",
  "RESOLVED_NOT_PAYABLE",
] as const;
/** Estados que aún deben algo (para mora y outstanding). */
export const DEBT_STATES = ["OPEN", "DISPUTED", "RESOLVED_PAYABLE", "PARTIALLY_PAID"] as const;
/** Estados terminales: no admiten más liquidación. */
export const CLOSED_STATES = ["PAID", "RESOLVED_NOT_PAYABLE"] as const;
export type ObligationState = (typeof OBLIGATION_STATES)[number];

function asBool(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "TRUE";
}

export function isObligationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return asBool(env[OBLIGATION_FLAG]);
}

export type SettlementInstrument = "bunz" | "fiat" | "mixed";

/** La liquidación es una acción económica: apagada salvo autorización explícita. */
export function isSettlementEnabled(
  instrument: SettlementInstrument = "bunz",
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const bunz = asBool(env[SETTLEMENT_FLAG]);
  const fiat = asBool(env[FIAT_SETTLEMENT_FLAG]);
  if (instrument === "bunz") return bunz;
  if (instrument === "fiat") return fiat;
  return bunz && fiat;
}

/** Qué instrumentos están autorizados ahora mismo (para el panel). */
export function settlementCapabilities(env: NodeJS.ProcessEnv = process.env) {
  return {
    bunz: isSettlementEnabled("bunz", env),
    fiat: isSettlementEnabled("fiat", env),
  };
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
 * Mora: **no es un estado**, se deriva de `dueAt < now` (contrato v1.0).
 * Solo cuenta y suma lo pendiente; no escribe nada.
 */
export async function scanOverdue(
  db: ObligationDb,
  {
    now = new Date(),
    tables,
  }: { now?: Date; tables: { obligations: unknown } }
): Promise<{ ok: boolean; overdue: number; outstanding: number; errors: string[] }> {
  if (!isObligationsEnabled()) return { ok: true, overdue: 0, outstanding: 0, errors: [] };

  try {
    const rows = (await db
      .select()
      .from(tables.obligations)
      .where(
        and(
          inArray((tables.obligations as any).state, [...DEBT_STATES]),
          lte((tables.obligations as any).dueAt, now)
        )
      )) as any[];

    const outstanding = rows.reduce(
      (acc, r) => acc + Math.max(0, Number(r.amountBunz) - Number(r.settledBunz)),
      0
    );
    return { ok: true, overdue: rows.length, outstanding: Math.round(outstanding * 100) / 100, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzObligations] barrido de mora falló (no fatal): ${msg}`);
    return { ok: false, overdue: 0, outstanding: 0, errors: [msg] };
  }
}

export type SettlementResult = {
  ok: boolean;
  skipped?: boolean;
  state?: ObligationState;
  settledBunz?: number;
  settledFiatMxn?: number;
  settledEquivalentBunz?: number;
  errors: string[];
};

const INSTRUMENTS = new Set<SettlementInstrument>(["bunz", "fiat", "mixed"]);

/**
 * Liquida total o parcialmente una obligación, en Bunz, en fiat o mixto.
 *
 * - `bunz`  : mueve Bunz (`commission_reserved → treasury_bunz`).
 * - `fiat`  : registra MXN reales; **no** mueve Bunz.
 * - `mixed` : ambas cosas en la misma operación.
 *
 * La tasa (`bunzPerMxn`) es **por operación** y se guarda en el evento: no se
 * asume ninguna paridad global (G4 sigue pendiente). Cada instrumento tiene su
 * propio flag, así se puede pilotar uno sin el otro.
 */
export async function settleObligation(
  db: ObligationDb,
  {
    obligationId,
    bunz = 0,
    fiatMxn = 0,
    bunzPerMxn,
    actor = "god_admin",
    instrument: rawInstrument = "bunz",
    at = new Date(),
    tables,
  }: {
    obligationId: string;
    bunz?: number;
    fiatMxn?: number;
    /** Bunz por cada MXN. Obligatoria si hay componente fiat. */
    bunzPerMxn?: number;
    actor?: string;
    instrument?: SettlementInstrument;
    at?: Date;
    tables: {
      obligations: unknown;
      events: unknown;
      ledger: unknown;
      /** Requeridos si RABBITTY_BUNZ_PILOT está encendido. */
      controls?: {
        limits: unknown;
        orders: unknown;
        branches: unknown;
        restaurants: unknown;
        attempts: unknown;
      };
    };
  }
): Promise<SettlementResult> {
  const instrument: SettlementInstrument = INSTRUMENTS.has(rawInstrument) ? rawInstrument : "bunz";
  const wantsBunz = instrument === "bunz" || instrument === "mixed";
  const wantsFiat = instrument === "fiat" || instrument === "mixed";

  if (!isSettlementEnabled(instrument)) {
    return {
      ok: false,
      skipped: true,
      errors: [
        instrument === "fiat"
          ? "RABBITTY_BUNZ_SETTLE_FIAT apagado"
          : instrument === "mixed"
            ? "liquidación mixta requiere ambos flags"
            : "RABBITTY_BUNZ_SETTLE apagado",
      ],
    };
  }

  const bunzAmount = wantsBunz ? Number(bunz) : 0;
  const fiatAmount = wantsFiat ? Number(fiatMxn) : 0;
  if (wantsBunz && !(bunzAmount > 0)) return { ok: false, errors: ["importe Bunz inválido"] };
  if (wantsFiat && !(fiatAmount > 0)) return { ok: false, errors: ["importe fiat inválido"] };
  if (wantsFiat && !(Number(bunzPerMxn) > 0)) {
    return { ok: false, errors: ["bunzPerMxn es obligatorio para liquidar en fiat"] };
  }

  try {
    return await db.transaction(async (sp) => {
      const [row] = (await sp
        .select()
        .from(tables.obligations)
        .where(eq((tables.obligations as any).id, obligationId))) as any[];

      if (!row) return { ok: false, errors: [`obligación ${obligationId} no existe`] };
      if (CLOSED_STATES.includes(row.state)) {
        return { ok: false, state: row.state, errors: [`obligación ya ${row.state}`] };
      }

      // Base ya liquidada (equivalente Bunz). Compatibilidad con filas previas
      // a la columna: cae a settledBunz.
      const already =
        Number(row.settledEquivalentBunz) || Number(row.settledBunz) || 0;
      const remaining = Math.max(0, Number(row.amountBunz) - already);
      if (!(remaining > 0)) return { ok: false, state: row.state, errors: ["nada por liquidar"] };

      const bunzApplied = wantsBunz ? Math.min(bunzAmount, remaining) : 0;
      const fiatEquivalent = wantsFiat ? fiatAmount * Number(bunzPerMxn) : 0;
      const totalApplied = bunzApplied + fiatEquivalent;

      if (isPilotMode() && !tables.controls) {
        return { ok: false, errors: ["piloto activo sin tablas de control configuradas"] };
      }
      const control = await checkOperation(sp, {
        affiliateId: row.affiliateId,
        operation: "settlement",
        amount: totalApplied,
        now: at,
        tables: {
          limits: tables.controls?.limits,
          orders: tables.controls?.orders,
          branches: tables.controls?.branches,
          restaurants: tables.controls?.restaurants,
          attempts: tables.controls?.attempts,
          obligations: tables.obligations,
        },
      });
      if (!control.allowed) {
        return { ok: false, state: row.state, errors: [control.reason ?? "bloqueado por el piloto"] };
      }

      if (totalApplied > remaining + 0.01) {
        return {
          ok: false,
          state: row.state,
          errors: [
            `la liquidación (${totalApplied.toFixed(2)} Bunz eq.) excede lo pendiente (${remaining.toFixed(2)})`,
          ],
        };
      }

      const newBunz = Math.round((Number(row.settledBunz) + bunzApplied) * 100) / 100;
      const newFiat = Math.round((Number(row.settledFiatMxn) + fiatAmount) * 100) / 100;
      const newEquivalent = Math.round((already + totalApplied) * 100) / 100;
      const fully = cents(newEquivalent) >= cents(row.amountBunz);
      const state: ObligationState = fully ? "PAID" : "PARTIALLY_PAID";
      const seq = cents(newEquivalent);

      const parts: string[] = [];
      if (bunzApplied > 0) parts.push(`${bunzApplied} Bunz`);
      if (fiatAmount > 0) parts.push(`${fiatAmount} MXN @ ${bunzPerMxn} Bunz/MXN`);

      await sp
        .update(tables.obligations)
        .set({
          state,
          settledBunz: newBunz,
          settledFiatMxn: newFiat,
          settledEquivalentBunz: newEquivalent,
          settledAt: at,
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
          note: `liquidación ${instrument}: ${parts.join(" + ")}`,
        })
        .onConflictDoNothing();

      // Solo la parte Bunz genera asiento en el libro Bunz.
      if (bunzApplied > 0) {
        await recordSettlementBooks(sp, {
          obligationId,
          bunz: bunzApplied,
          at,
          seq,
          tables: { ledger: tables.ledger },
        });
      }

      return {
        ok: true,
        state,
        settledBunz: newBunz,
        settledFiatMxn: newFiat,
        settledEquivalentBunz: newEquivalent,
        errors: [],
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzObligations] liquidación ${obligationId} falló: ${msg}`);
    return { ok: false, errors: [msg] };
  }
}
