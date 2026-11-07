/**
 * ── RP-2B: controles del piloto económico ────────────────────────────────────
 *
 * Tres piezas, todas **read-only** hasta que el piloto se encienda:
 *  1. Kill switches independientes: emisión y redención.
 *  2. Lista blanca: con `RABBITTY_BUNZ_PILOT=true`, solo los afiliados con
 *     `pilotEnabled=true` pueden emitir, redimir o liquidar.
 *  3. Topes duros por periodo y operación (`bunz_economic_limits`).
 *
 * Sin `RABBITTY_BUNZ_PILOT`, el comportamiento es el actual (sin topes).
 * Los topes se consultan antes de ejecutar; nunca mueven dinero.
 */

import { and, eq, gte, sql } from "drizzle-orm";

export const PILOT_FLAG = "RABBITTY_BUNZ_PILOT";
export const EMIT_FLAG = "RABBITTY_BUNZ_EMIT";
export const REDEEM_FLAG = "RABBITTY_BUNZ_REDEEM";

const DAY = 86_400_000;

function on(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE";
}

/** Piloto apagado por defecto: sin lista blanca ni topes. */
export function isPilotMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return on(env[PILOT_FLAG]);
}

/** Kill switch de emisión. Encendido salvo que se apague explícitamente. */
export function isEmissionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[EMIT_FLAG] === undefined ? true : on(env[EMIT_FLAG]);
}

/** Kill switch de redención. Encendido salvo que se apague explícitamente. */
export function isRedemptionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[REDEEM_FLAG] === undefined ? true : on(env[REDEEM_FLAG]);
}

export type EconomicOperation = "emission" | "redemption" | "settlement";

export type ControlDecision = {
  allowed: boolean;
  reason?: string;
  used?: number;
  cap?: number;
  pilotEnabled?: boolean;
};

type ControlTables = {
  limits: any;
  orders: any;
  branches: any;
  restaurants: any;
  attempts: any;
  obligations: any;
  /** Si existe, aplica la pausa escrita por la conciliación. */
  controlState?: any;
};

type ControlDb = {
  select: (cols?: any) => any;
};

/** Resuelve el afiliado (ownedBusinesses.id) desde una sucursal. */
export async function resolveAffiliateId(
  db: ControlDb,
  branchId: string,
  tables: { branches: any; restaurants: any }
): Promise<string | null> {
  const [branch] = await db
    .select({ restaurantId: tables.branches.restaurantId })
    .from(tables.branches)
    .where(eq(tables.branches.id, branchId))
    .limit(1);
  if (!branch?.restaurantId) return null;
  const [restaurant] = await db
    .select({ businessId: tables.restaurants.businessId })
    .from(tables.restaurants)
    .where(eq(tables.restaurants.id, branch.restaurantId))
    .limit(1);
  return restaurant?.businessId ?? null;
}

async function usedInPeriod(
  db: ControlDb,
  tables: ControlTables,
  operation: EconomicOperation,
  affiliateId: string,
  since: Date
): Promise<number> {
  if (operation === "emission") {
    const [row] = await db
      .select({ used: sql<number>`coalesce(sum(${tables.orders.bunzReward}), 0)` })
      .from(tables.orders)
      .innerJoin(tables.branches, eq(tables.branches.id, tables.orders.branchId))
      .innerJoin(tables.restaurants, eq(tables.restaurants.id, tables.branches.restaurantId))
      .where(
        and(
          eq(tables.restaurants.businessId, affiliateId),
          gte(tables.orders.createdAt, since)
        )
      );
    return Number(row?.used) || 0;
  }

  if (operation === "redemption") {
    const [row] = await db
      .select({ used: sql<number>`coalesce(sum(${tables.attempts.bunzFulfilled}), 0)` })
      .from(tables.attempts)
      .innerJoin(tables.branches, eq(tables.branches.id, tables.attempts.branchId))
      .innerJoin(tables.restaurants, eq(tables.restaurants.id, tables.branches.restaurantId))
      .where(
        and(
          eq(tables.restaurants.businessId, affiliateId),
          gte(tables.attempts.requestedAt, since)
        )
      );
    return Number(row?.used) || 0;
  }

  const [row] = await db
    .select({ used: sql<number>`coalesce(sum(${tables.obligations.settledEquivalentBunz}), 0)` })
    .from(tables.obligations)
    .where(
      and(
        eq(tables.obligations.affiliateId, affiliateId),
        gte(tables.obligations.settledAt, since)
      )
    );
  return Number(row?.used) || 0;
}

/**
 * Decide si una operación puede ejecutarse. No lanza: devuelve la razón.
 * Con el piloto apagado solo aplican los kill switches.
 */
export async function checkOperation(
  db: ControlDb,
  {
    affiliateId,
    operation,
    amount,
    now = new Date(),
    tables,
  }: {
    affiliateId: string | null | undefined;
    operation: EconomicOperation;
    amount: number;
    now?: Date;
    tables: ControlTables;
  }
): Promise<ControlDecision> {
  if (tables.controlState) {
    const [state] = await db
      .select()
      .from(tables.controlState)
      .where(eq(tables.controlState.id, "global"))
      .limit(1);
    const paused =
      operation === "emission"
        ? state?.emissionPaused
        : operation === "redemption"
          ? state?.redemptionPaused
          : state?.settlementPaused;
    if (paused) {
      return {
        allowed: false,
        reason: `pausado por conciliación: ${state?.reason ?? "alerta sin detalle"}`,
      };
    }
  }

  if (operation === "emission" && !isEmissionEnabled()) {
    return { allowed: false, reason: "RABBITTY_BUNZ_EMIT apagado" };
  }
  if (operation === "redemption" && !isRedemptionEnabled()) {
    return { allowed: false, reason: "RABBITTY_BUNZ_REDEEM apagado" };
  }

  if (!isPilotMode()) return { allowed: true };
  if (!affiliateId) return { allowed: false, reason: "afiliado no resuelto para el piloto" };

  const [limits] = await db
    .select()
    .from(tables.limits)
    .where(eq(tables.limits.affiliateId, affiliateId))
    .limit(1);

  if (!limits || !limits.pilotEnabled) {
    return { allowed: false, reason: `afiliado ${affiliateId} fuera del piloto`, pilotEnabled: false };
  }

  const cap =
    operation === "emission"
      ? Number(limits.maxEmissionBunz) || 0
      : operation === "redemption"
        ? Number(limits.maxRedemptionBunz) || 0
        : Number(limits.maxSettlementBunz) || 0;

  const periodDays = Math.max(1, Number(limits.periodDays) || 7);
  const since = new Date(now.getTime() - periodDays * DAY);
  const used = await usedInPeriod(db, tables, operation, affiliateId, since);
  const requested = Math.max(0, Number(amount) || 0);

  if (used + requested > cap + 0.01) {
    return {
      allowed: false,
      reason: `tope de ${operation} alcanzado: ${used.toFixed(2)} + ${requested.toFixed(2)} > ${cap.toFixed(2)} (${periodDays} días)`,
      used,
      cap,
      pilotEnabled: true,
    };
  }

  return { allowed: true, used, cap, pilotEnabled: true };
}
