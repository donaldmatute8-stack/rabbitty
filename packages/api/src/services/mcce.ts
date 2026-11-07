/**
 * ── MCCE · Motor de capacidad ────────────────────────────────────────────────
 *
 * Modos:
 *   off      → no escribe nada (comportamiento actual).
 *   shadow   → registra eventos y cálculos, sin tocar saldos.
 *   dual     → actualiza la cuenta y mantiene `bunzBalance` en espejo.
 *   enforce  → la cuenta es la fuente; `bunzBalance` se mantiene por compatibilidad.
 *
 * Reglas:
 *  - La recuperación sale del excedente de capacidad generada; nunca de lo comprometido.
 *  - El valor no se cuenta dos veces: generatedGross = generatedNet + retained.
 *  - Idempotencia por `orderId` / `intentId` / `refundId`.
 *  - Si no hay cuenta o no está activa, no se escribe.
 */

import { eq } from "drizzle-orm";
import {
  merchantCapacityAccounts,
  merchantCapacityEvents,
  ownedBusinesses,
} from "@rabbitty/database-core";

export const MCCE_ENABLED_FLAG = "RABBITTY_MCCE_ENABLED";
export const MCCE_MODE_FLAG = "RABBITTY_MCCE_MODE";
export const MCCE_RECOVERY_MODE_FLAG = "RABBITTY_MCCE_RECOVERY_MODE";

export type McceMode = "off" | "shadow" | "dual" | "enforce";

export function mcceMode(env: NodeJS.ProcessEnv = process.env): McceMode {
  const enabled = env[MCCE_ENABLED_FLAG] === "true" || env[MCCE_ENABLED_FLAG] === "1";
  if (!enabled) return "off";
  const mode = env[MCCE_MODE_FLAG];
  if (mode === "shadow" || mode === "dual" || mode === "enforce") return mode;
  return "shadow";
}

/**
 * Recuperación:
 *   per_event → retiene en la misma operación que genera capacidad (comportamiento previo).
 *   proposal  → no retiene por evento; acumula la base y crea una propuesta por ciclo
 *               que el afiliado acepta o rechaza. Es el modo recomendado.
 */
export type RecoveryMode = "per_event" | "proposal";

export function recoveryMode(env: NodeJS.ProcessEnv = process.env): RecoveryMode {
  return env[MCCE_RECOVERY_MODE_FLAG] === "per_event" ? "per_event" : "proposal";
}

const ACTIVE_STATES = new Set(["ACTIVE", "AUTHORIZED"]);
const EPS = 0.01;
const round2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

type Tx = any;

async function accountForUpdate(tx: Tx, affiliateId: string) {
  const [account] = await tx
    .select()
    .from(merchantCapacityAccounts)
    .where(eq(merchantCapacityAccounts.affiliateId, affiliateId))
    .for("update");
  return account ?? null;
}

async function eventExists(tx: Tx, id: string): Promise<boolean> {
  const [prior] = await tx
    .select({ id: merchantCapacityEvents.id })
    .from(merchantCapacityEvents)
    .where(eq(merchantCapacityEvents.id, id))
    .limit(1);
  return Boolean(prior);
}

async function writeEvent(tx: Tx, row: Record<string, unknown>) {
  await tx.insert(merchantCapacityEvents).values(row).onConflictDoNothing();
}

async function syncBusinessBalance(tx: Tx, affiliateId: string, available: number, mode: McceMode) {
  if (mode === "shadow" || mode === "off") return;
  await tx
    .update(ownedBusinesses)
    .set({ bunzBalance: Math.max(0, available) })
    .where(eq(ownedBusinesses.id, affiliateId));
}

export type ActivityResult = {
  ok: boolean;
  skipped?: string;
  retained?: number;
  generatedNet?: number;
  creditOutstandingAfter?: number;
  availableAfter?: number;
  recoveryMode?: RecoveryMode;
  mode: McceMode;
};

/**
 * Reconoce capacidad nueva por actividad elegible.
 * `reward` es la capacidad bruta generada (Bunz emitidos por la venta).
 *
 * En recuperación `proposal` no retiene nada aquí: toda la capacidad bruta se
 * registra y la recuperación se propone al cierre del ciclo.
 */
export async function recognizeActivity(
  tx: Tx,
  {
    affiliateId,
    reward,
    orderId,
    at = new Date(),
  }: { affiliateId: string; reward: number; orderId: string; at?: Date }
): Promise<ActivityResult> {
  const mode = mcceMode();
  if (mode === "off") return { ok: true, skipped: "disabled", mode };
  const gross = Math.max(0, Number(reward) || 0);
  if (!(gross > 0) || !affiliateId) return { ok: true, skipped: "empty", mode };

  const account = await accountForUpdate(tx, affiliateId);
  if (!account) return { ok: true, skipped: "no-account", mode };
  if (!ACTIVE_STATES.has(String(account.status))) {
    return { ok: true, skipped: `status:${account.status}`, mode };
  }

  const eventId = `mce-act-${orderId}`;
  if (await eventExists(tx, eventId)) return { ok: true, skipped: "idempotent", mode };

  const recovery = recoveryMode();
  const outstanding = Math.max(0, Number(account.creditOutstanding) || 0);
  const committed = Math.max(0, Number(account.committed) || 0);
  const available = Math.max(0, Number(account.available) || 0);
  const retainShare = Math.min(Math.max(Number(account.retainShare) || 0.4, 0), 1);

  // Cobertura: si lo disponible ya no cubre lo comprometido, no se retiene.
  const coverageBlocked = available + EPS < committed;
  const retained =
    recovery === "proposal" || coverageBlocked
      ? 0
      : Math.min(gross, outstanding, gross * retainShare);
  const generatedNet = round2(gross - retained);
  const newProvisioned = round2(Number(account.provisioned) + generatedNet);
  const newGenerated = round2(Number(account.generated) + gross);
  const newOutstanding = round2(Math.max(0, outstanding - retained));
  const newRepaid = round2(Number(account.creditRepaid) + retained);
  const newAvailable = round2(Math.max(0, newProvisioned - committed));

  if (mode !== "shadow") {
    await tx
      .update(merchantCapacityAccounts)
      .set({
        provisioned: newProvisioned,
        generated: newGenerated,
        available: newAvailable,
        creditOutstanding: newOutstanding,
        creditRepaid: newRepaid,
        updatedAt: at,
      })
      .where(eq(merchantCapacityAccounts.affiliateId, affiliateId));
    await syncBusinessBalance(tx, affiliateId, newAvailable, mode);
  }

  await writeEvent(tx, {
    id: eventId,
    affiliateId,
    type: "ACTIVITY_RECOGNIZED",
    actor: "system",
    amount: generatedNet,
    metadata: {
      mode,
      recoveryMode: recovery,
      shadow: mode === "shadow",
      orderId,
      gross,
      retained,
      generatedNet,
      coverageBlocked,
      creditOutstandingBefore: outstanding,
      creditOutstandingAfter: newOutstanding,
      availableAfter: newAvailable,
    },
  });

  return {
    ok: true,
    retained,
    generatedNet,
    creditOutstandingAfter: newOutstanding,
    availableAfter: newAvailable,
    recoveryMode: recovery,
    mode,
  };
}

/** Consume capacidad por una redención confirmada. */
export async function consumeCapacity(
  tx: Tx,
  {
    affiliateId,
    bunz,
    intentId,
    at = new Date(),
  }: { affiliateId: string; bunz: number; intentId: string; at?: Date }
): Promise<{ ok: boolean; skipped?: string; availableAfter?: number; mode: McceMode }> {
  const mode = mcceMode();
  if (mode === "off") return { ok: true, skipped: "disabled", mode };
  const amount = Math.max(0, Number(bunz) || 0);
  if (!(amount > 0) || !affiliateId) return { ok: true, skipped: "empty", mode };

  const account = await accountForUpdate(tx, affiliateId);
  if (!account) return { ok: true, skipped: "no-account", mode };
  if (!ACTIVE_STATES.has(String(account.status))) {
    return { ok: true, skipped: `status:${account.status}`, mode };
  }

  const eventId = `mce-consume-${intentId}`;
  if (await eventExists(tx, eventId)) return { ok: true, skipped: "idempotent", mode };

  const committed = Math.max(0, Number(account.committed) || 0);
  const newProvisioned = round2(Math.max(0, Number(account.provisioned) - amount));
  const newCommitted = round2(Math.max(0, committed - amount));
  const newAvailable = round2(Math.max(0, newProvisioned - newCommitted));

  if (mode !== "shadow") {
    await tx
      .update(merchantCapacityAccounts)
      .set({
        provisioned: newProvisioned,
        committed: newCommitted,
        available: newAvailable,
        updatedAt: at,
      })
      .where(eq(merchantCapacityAccounts.affiliateId, affiliateId));
    await syncBusinessBalance(tx, affiliateId, newAvailable, mode);
  }

  await writeEvent(tx, {
    id: eventId,
    affiliateId,
    type: "CAPACITY_CONSUMED",
    actor: "system",
    amount,
    metadata: {
      mode,
      shadow: mode === "shadow",
      intentId,
      provisionedAfter: newProvisioned,
      availableAfter: newAvailable,
    },
  });

  return { ok: true, availableAfter: newAvailable, mode };
}

/** Restaura capacidad por reverso o reembolso. */
export async function restoreCapacity(
  tx: Tx,
  {
    affiliateId,
    bunz,
    refundId,
    at = new Date(),
  }: { affiliateId: string; bunz: number; refundId: string; at?: Date }
): Promise<{ ok: boolean; skipped?: string; availableAfter?: number; mode: McceMode }> {
  const mode = mcceMode();
  if (mode === "off") return { ok: true, skipped: "disabled", mode };
  const amount = Math.max(0, Number(bunz) || 0);
  if (!(amount > 0) || !affiliateId) return { ok: true, skipped: "empty", mode };

  const account = await accountForUpdate(tx, affiliateId);
  if (!account) return { ok: true, skipped: "no-account", mode };

  const eventId = `mce-refund-${refundId}`;
  if (await eventExists(tx, eventId)) return { ok: true, skipped: "idempotent", mode };

  const committed = Math.max(0, Number(account.committed) || 0);
  const newProvisioned = round2(Number(account.provisioned) + amount);
  const newAvailable = round2(Math.max(0, newProvisioned - committed));

  if (mode !== "shadow") {
    await tx
      .update(merchantCapacityAccounts)
      .set({ provisioned: newProvisioned, available: newAvailable, updatedAt: at })
      .where(eq(merchantCapacityAccounts.affiliateId, affiliateId));
    await syncBusinessBalance(tx, affiliateId, newAvailable, mode);
  }

  await writeEvent(tx, {
    id: eventId,
    affiliateId,
    type: "CAPACITY_RESTORED",
    actor: "system",
    amount,
    metadata: { mode, shadow: mode === "shadow", refundId, availableAfter: newAvailable },
  });

  return { ok: true, availableAfter: newAvailable, mode };
}

/** Invariantes de una cuenta. Devuelve errores legibles. */
export function validateCapacityAccount(account: Record<string, unknown>): string[] {
  const n = (v: unknown) => Number(v) || 0;
  const errors: string[] = [];
  const disbursed = n(account.creditDisbursed);
  const repaid = n(account.creditRepaid);
  const outstanding = n(account.creditOutstanding);
  const provisioned = n(account.provisioned);
  const committed = n(account.committed);
  const available = n(account.available);

  if (repaid > disbursed + EPS) errors.push("recuperación mayor que capacidad adelantada");
  if (Math.abs(repaid + outstanding - disbursed) > EPS) {
    errors.push("recuperado + pendiente no cuadra con lo adelantado");
  }
  if (outstanding < -EPS) errors.push("pendiente negativo");
  if (provisioned < committed - EPS) errors.push("provisionado menor que comprometido");
  if (available < -EPS) errors.push("disponible negativo");
  if (Math.abs(available - Math.max(0, provisioned - committed)) > EPS) {
    errors.push("disponible no sigue provisionado − comprometido");
  }
  return errors;
}
