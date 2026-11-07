/**
 * ── OT-2: devengo de obligaciones por comisión ──────────────────────────────
 *
 * Al cobrar una orden se devenga la comisión del afiliado (6% por defecto, igual
 * que el modelo). La obligación nace OPEN y vence a los 15 días.
 *
 * No mueve dinero: es deuda. La liquidación (Bunz) es otro paso y depende de G3.
 * Idempotente por `ob-<orderId>`. Detrás de `RABBITTY_BUNZ_OBLIGATIONS`.
 */

export const OBLIGATION_FLAG = "RABBITTY_BUNZ_OBLIGATIONS";
export const COMMISSION_RATE = 0.06;
export const DUE_DAYS = 15;

export function isObligationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env[OBLIGATION_FLAG];
  return v === "1" || v === "true" || v === "TRUE";
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
    state: "OPEN",
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
