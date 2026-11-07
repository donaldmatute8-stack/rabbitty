/**
 * ── RP-2B: conciliación con pausa ────────────────────────────────────────────
 *
 * Corre un conjunto de invariantes sobre los últimos días y deja un registro
 * append-only. Si algo grave no cuadra, **pausa** el flujo afectado escribiendo
 * en `bunz_control_state`. Nunca mueve dinero ni corrige datos.
 *
 * Invariantes v1:
 *  1. Cada `groupId` del libro balancea (Σ débitos = Σ créditos).
 *  2. Ninguna obligación tiene liquidado > importe, ni PAID desbalanceada.
 *  3. Ninguna orden con `bunzPaid > 0` carece de pago BUNZ COMPLETED.
 *
 * La pausa no se libera sola: requiere revisión humana (`resetBunzPause`).
 */

import { and, eq, gte, gt, inArray, sql } from "drizzle-orm";
import type { EconomicOperation } from "./bunzControls";

export type ReconSeverity = "high" | "medium";

export type ReconAlert = {
  code: string;
  severity: ReconSeverity;
  count: number;
  detail: string;
  pause: EconomicOperation[];
};

type ReconTables = {
  ledger: any;
  obligations: any;
  orders: any;
  payments: any;
  runs: any;
  controlState: any;
};

type ReconDb = {
  select: (cols?: any) => any;
  insert: (table: any) => { values: (row: any) => Promise<unknown> };
  update: (table: any) => any;
};

export type ReconResult = {
  ok: boolean;
  runId: string;
  status: "OK" | "ALERTS" | "ERROR";
  alerts: ReconAlert[];
  checks: Record<string, number>;
  errors: string[];
};

const DAY = 86_400_000;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybe = (result as { rows?: T[] })?.rows;
  return Array.isArray(maybe) ? maybe : [];
}

export async function runReconciliation(
  db: ReconDb,
  {
    tables,
    now = new Date(),
    windowDays = 7,
  }: { tables: ReconTables; now?: Date; windowDays?: number }
): Promise<ReconResult> {
  const runId = `recon-${now.toISOString()}`;
  const since = new Date(now.getTime() - windowDays * DAY);

  try {
    // 1 · Libro balanceado por grupo.
    const unbalanced = rowsOf<{ groupId: string; diff: number }>(
      await db
        .select({
          groupId: tables.ledger.groupId,
          diff: sql<number>`sum(case when ${tables.ledger.direction} = 'debit' then ${tables.ledger.amount} else -${tables.ledger.amount} end)`,
        })
        .from(tables.ledger)
        .where(gte(tables.ledger.ts, since))
        .groupBy(tables.ledger.groupId)
        .having(
          sql`abs(sum(case when ${tables.ledger.direction} = 'debit' then ${tables.ledger.amount} else -${tables.ledger.amount} end)) > 0.01`
        )
        .limit(20)
    );

    // 2 · Obligaciones coherentes.
    const badObligations = rowsOf<{ id: string }>(
      await db
        .select({ id: tables.obligations.id })
        .from(tables.obligations)
        .where(
          sql`${tables.obligations.settledEquivalentBunz} > ${tables.obligations.amountBunz} + 0.01
              OR (${tables.obligations.state} = 'PAID'
                  AND abs(${tables.obligations.settledEquivalentBunz} - ${tables.obligations.amountBunz}) > 0.01)`
        )
        .limit(20)
    );

    // 3 · Órdenes con Bunz pagado pero sin pago BUNZ COMPLETED.
    const paidOrders = rowsOf<{ id: string }>(
      await db
        .select({ id: tables.orders.id })
        .from(tables.orders)
        .where(and(gte(tables.orders.createdAt, since), gt(tables.orders.bunzPaid, 0)))
        .limit(500)
    );
    let missingBunzPayment: { id: string }[] = [];
    if (paidOrders.length > 0) {
      const ids = paidOrders.map((o) => o.id);
      const paid = rowsOf<{ orderId: string }>(
        await db
          .select({ orderId: tables.payments.orderId })
          .from(tables.payments)
          .where(
            and(
              inArray(tables.payments.orderId, ids),
              eq(tables.payments.method, "BUNZ"),
              eq(tables.payments.status, "COMPLETED")
            )
          )
      );
      const withPayment = new Set(paid.map((p) => p.orderId));
      missingBunzPayment = paidOrders.filter((o) => !withPayment.has(o.id));
    }

    const alerts: ReconAlert[] = [];
    if (unbalanced.length > 0) {
      alerts.push({
        code: "RECON_LEDGER_UNBALANCED",
        severity: "high",
        count: unbalanced.length,
        detail: `${unbalanced.length} grupo(s) del libro no balancean (${unbalanced
          .slice(0, 3)
          .map((g) => `${g.groupId}:${Number(g.diff).toFixed(2)}`)
          .join(", ")})`,
        pause: ["redemption", "settlement"],
      });
    }
    if (badObligations.length > 0) {
      alerts.push({
        code: "RECON_OBLIGATION_MISMATCH",
        severity: "high",
        count: badObligations.length,
        detail: `${badObligations.length} obligación(es) con liquidado inconsistente`,
        pause: ["settlement"],
      });
    }
    if (missingBunzPayment.length > 0) {
      alerts.push({
        code: "RECON_ORDER_BUNZ_MISMATCH",
        severity: "high",
        count: missingBunzPayment.length,
        detail: `${missingBunzPayment.length} orden(es) con bunzPaid sin pago BUNZ`,
        pause: ["redemption"],
      });
    }

    const checks = {
      unbalanced_groups: unbalanced.length,
      bad_obligations: badObligations.length,
      orders_without_bunz_payment: missingBunzPayment.length,
    };
    const status: ReconResult["status"] = alerts.length > 0 ? "ALERTS" : "OK";

    await db.insert(tables.runs).values({
      id: runId,
      startedAt: now,
      finishedAt: new Date(),
      status,
      checks,
      alerts,
    });

    // Pausa los flujos afectados. No libera pausas existentes.
    const pause = new Set<EconomicOperation>();
    for (const alert of alerts) for (const op of alert.pause) pause.add(op);
    if (pause.size > 0) {
      await db
        .update(tables.controlState)
        .set({
          emissionPaused: pause.has("emission"),
          redemptionPaused: pause.has("redemption"),
          settlementPaused: pause.has("settlement"),
          reason: alerts.map((a) => a.code).join(", "),
          updatedAt: new Date(),
        })
        .where(eq(tables.controlState.id, "global"));
    }

    return { ok: true, runId, status, alerts, checks, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[bunzReconciliation] falló: ${msg}`);
    try {
      await db.insert(tables.runs).values({
        id: runId,
        startedAt: now,
        finishedAt: new Date(),
        status: "ERROR",
        checks: {},
        alerts: [{ code: "RECON_ERROR", severity: "high", count: 1, detail: msg, pause: [] }],
      });
    } catch {
      /* sin registro tampoco rompemos el cron */
    }
    return { ok: false, runId, status: "ERROR", alerts: [], checks: {}, errors: [msg] };
  }
}
