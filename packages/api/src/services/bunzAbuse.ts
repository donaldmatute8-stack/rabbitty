/**
 * ── OT-5: señales de abuso ───────────────────────────────────────────────────
 *
 * Detección determinista, explicable y **no punitiva**: solo escribe señales
 * para revisión humana. No bloquea cobros, redenciones ni cuentas.
 *
 * Reglas (todas sobre ventanas móviles, sin ML):
 *  1. rapid_redemption : ≥3 intentos de redención del mismo usuario en 24 h.
 *  2. redemption_burst : ≥1000 Bunz solicitados por el mismo usuario en 24 h.
 *  3. discount_streak  : ≥3 pedidos del mismo cliente en 7 días pagando ≥30%
 *                        del total con Bunz.
 *
 * Ids deterministas (`sig-<tipo>-<hash>-<día>`) para que el cron sea idempotente.
 * Detrás de `RABBITTY_BUNZ_ABUSE`.
 */

import { hashUser } from "./bunzBooks";

export const ABUSE_FLAG = "RABBITTY_BUNZ_ABUSE";

const DAY = 86_400_000;
export const RAPID_WINDOW_MS = DAY;
export const RAPID_COUNT = 3;
export const BURST_BUNZ = 1000;
export const DISCOUNT_WINDOW_MS = 7 * DAY;
export const DISCOUNT_MIN_ORDERS = 3;
export const DISCOUNT_RATIO = 0.3;

export type AbuseSeverity = "low" | "medium" | "high";

export type AbuseSignal = {
  id: string;
  detectedAt: Date;
  userHash: string;
  type: "rapid_redemption" | "redemption_burst" | "discount_streak";
  severity: AbuseSeverity;
  affiliateId: string | null;
  refType: string | null;
  refId: string | null;
  detail: Record<string, unknown>;
};

export function isAbuseEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env[ABUSE_FLAG];
  return v === "1" || v === "true" || v === "TRUE";
}

export function dayKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

type AttemptRow = {
  id: string;
  userHash: string;
  requestedAt: Date | string;
  bunzRequested: number;
  branchId?: string | null;
};

type OrderRow = {
  id: string;
  customerId: string | null;
  createdAt: Date | string;
  total: number;
  bunzPaid: number;
  businessId?: string | null;
};

const ts = (v: Date | string) => new Date(v).getTime();

/** Ventana móvil: devuelve el tramo con más eventos y su inicio. */
function densestWindow<T>(rows: T[], getTime: (r: T) => number, windowMs: number) {
  const sorted = [...rows].sort((a, b) => getTime(a) - getTime(b));
  let best: T[] = [];
  let start = 0;
  for (let end = 0; end < sorted.length; end++) {
    while (getTime(sorted[end]!) - getTime(sorted[start]!) > windowMs) start++;
    if (end - start + 1 > best.length) best = sorted.slice(start, end + 1);
  }
  return best;
}

/** Reglas 1 y 2 sobre intentos de redención. */
export function detectRedemptionSignals(rows: AttemptRow[], now = new Date()): AbuseSignal[] {
  const out: AbuseSignal[] = [];
  const byUser = new Map<string, AttemptRow[]>();
  for (const r of rows) {
    const k = r.userHash || "walkin";
    const list = byUser.get(k) ?? [];
    list.push(r);
    byUser.set(k, list);
  }

  for (const [userHash, list] of byUser) {
    const dense = densestWindow(list, (r) => ts(r.requestedAt), RAPID_WINDOW_MS);
    if (dense.length >= RAPID_COUNT) {
      const last = dense[dense.length - 1]!;
      out.push({
        id: `sig-rapid-${userHash}-${dayKey(last.requestedAt)}`,
        detectedAt: now,
        userHash,
        type: "rapid_redemption",
        severity: dense.length >= RAPID_COUNT * 2 ? "high" : "medium",
        affiliateId: last.branchId ?? null,
        refType: "redemption_attempt",
        refId: last.id,
        detail: { count: dense.length, windowHours: 24 },
      });
    }

    let best: AttemptRow[] = [];
    let bestSum = 0;
    let start = 0;
    const sorted = [...list].sort((a, b) => ts(a.requestedAt) - ts(b.requestedAt));
    let sum = 0;
    for (let end = 0; end < sorted.length; end++) {
      sum += Number(sorted[end]!.bunzRequested) || 0;
      while (ts(sorted[end]!.requestedAt) - ts(sorted[start]!.requestedAt) > RAPID_WINDOW_MS) {
        sum -= Number(sorted[start]!.bunzRequested) || 0;
        start++;
      }
      if (sum > bestSum) {
        bestSum = sum;
        best = sorted.slice(start, end + 1);
      }
    }
    if (bestSum >= BURST_BUNZ && best.length) {
      const last = best[best.length - 1]!;
      out.push({
        id: `sig-burst-${userHash}-${dayKey(last.requestedAt)}`,
        detectedAt: now,
        userHash,
        type: "redemption_burst",
        severity: "high",
        affiliateId: last.branchId ?? null,
        refType: "redemption_attempt",
        refId: last.id,
        detail: { bunzRequested: Math.round(bestSum * 100) / 100, windowHours: 24 },
      });
    }
  }
  return out;
}

/** Regla 3: pedidos pagados mayormente con Bunz, repetidos en 7 días. */
export function detectDiscountStreak(rows: OrderRow[], now = new Date()): AbuseSignal[] {
  const out: AbuseSignal[] = [];
  const byCustomer = new Map<string, OrderRow[]>();
  for (const r of rows) {
    if (!r.customerId) continue;
    const total = Number(r.total) || 0;
    const paid = Number(r.bunzPaid) || 0;
    if (total <= 0 || paid <= 0 || paid / total < DISCOUNT_RATIO) continue;
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  for (const [customerId, list] of byCustomer) {
    const dense = densestWindow(list, (r) => ts(r.createdAt), DISCOUNT_WINDOW_MS);
    if (dense.length < DISCOUNT_MIN_ORDERS) continue;
    const last = dense[dense.length - 1]!;
    const userHash = hashUser(customerId);
    out.push({
      id: `sig-discount-${userHash}-${dayKey(last.createdAt)}`,
      detectedAt: now,
      userHash,
      type: "discount_streak",
      severity: "medium",
      affiliateId: last.businessId ?? null,
      refType: "order",
      refId: last.id,
      detail: { orders: dense.length, windowDays: 7, ratioMin: DISCOUNT_RATIO },
    });
  }
  return out;
}

type AbuseDb = {
  select: (cols?: any) => any;
  insert: (table: any) => { values: (rows: any) => { onConflictDoNothing: () => Promise<unknown> } };
};

/**
 * Ejecuta la detección y persiste las señales. No lanza: devuelve el resultado.
 * Lee solo los últimos 30 días (ventana suficiente para las tres reglas).
 */
export async function runAbuseDetection(
  db: AbuseDb,
  {
    tables,
    now = new Date(),
    days = 30,
  }: { tables: { attempts: unknown; orders: unknown; signals: unknown }; now?: Date; days?: number }
): Promise<{ ok: boolean; detected: number; inserted: number; errors: string[] }> {
  if (!isAbuseEnabled()) return { ok: true, detected: 0, inserted: 0, errors: [] };

  try {
    const { gte } = await import("drizzle-orm");
    const since = new Date(now.getTime() - days * DAY);

    const attempts = (await db
      .select()
      .from(tables.attempts)
      .where(gte((tables.attempts as any).requestedAt, since))) as AttemptRow[];

    const orders = (await db
      .select()
      .from(tables.orders)
      .where(gte((tables.orders as any).createdAt, since))) as OrderRow[];

    const signals = [
      ...detectRedemptionSignals(attempts, now),
      ...detectDiscountStreak(orders, now),
    ];

    let inserted = 0;
    for (const s of signals) {
      try {
        await db.insert(tables.signals).values(s).onConflictDoNothing();
        inserted++;
      } catch (e) {
        console.warn(`[bunzAbuse] señal ${s.id} no escrita: ${e instanceof Error ? e.message : e}`);
      }
    }
    return { ok: true, detected: signals.length, inserted, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzAbuse] detección falló (no fatal): ${msg}`);
    return { ok: false, detected: 0, inserted: 0, errors: [msg] };
  }
}
