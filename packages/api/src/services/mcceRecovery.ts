/**
 * ── MCCE · Recuperación dinámica con propuestas ──────────────────────────────
 *
 * Flujo:
 *   1. Cierre de ciclo → se calcula una tasa según el progreso.
 *   2. Se crea una propuesta con el importe exacto.
 *   3. El afiliado acepta o rechaza desde un modal.
 *   4. Solo al aceptar se aplica (en dual/enforce); en shadow se registra.
 *
 * Nunca toca capacidad comprometida. Sin aceptación, no hay descuento.
 */

import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  merchantCapacityAccounts,
  merchantCapacityEvents,
  merchantRecoveryProposals,
  merchantRecoveryTerms,
  ownedBusinesses,
  users,
} from "@rabbitty/database-core";
import { mcceMode, recoveryMode } from "./mcce";

export { recoveryMode };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(Number(v) || 0, min), max);
const round2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const round5 = (v: number) => Math.round((Number(v) || 0) * 20) / 20;
const EPS = 0.01;

export type RecoveryRateInput = {
  outstanding: number;
  expectedMonthlyGenerated: number;
  coverageDays: number;
  targetMonths?: number;
  minCoverageDays?: number;
  rateMin?: number;
  rateMax?: number;
  repaidRatio?: number;
};

/** Tasa dinámica, acotada y redondeada al 5%. */
export function computeRecoveryRate({
  outstanding,
  expectedMonthlyGenerated,
  coverageDays,
  targetMonths = 18,
  minCoverageDays = 7,
  rateMin = 0.2,
  rateMax = 0.6,
  repaidRatio = 0,
}: RecoveryRateInput): number {
  const pending = Math.max(0, Number(outstanding) || 0);
  if (pending <= 0) return 0;
  const generated = Math.max(1, Number(expectedMonthlyGenerated) || 1);
  const requiredMonthly = pending / Math.max(1, targetMonths);
  const baseRate = requiredMonthly / generated;
  const coverageFactor = clamp((Number(coverageDays) || 0) / Math.max(1, minCoverageDays), 0.5, 1.5);
  const progressFactor = clamp(1 + (Number(repaidRatio) - 0.5) * 0.4, 0.8, 1.2);
  const raw = baseRate * coverageFactor * progressFactor;
  const bounded = clamp(round5(raw), rateMin, rateMax);
  // Si la cobertura está por debajo del mínimo, no se acelera la recuperación.
  if ((Number(coverageDays) || 0) < minCoverageDays) return rateMin;
  return bounded;
}

type Db = any;

export async function getOrCreateTerms(db: Db, affiliateId: string) {
  const [existing] = await db
    .select()
    .from(merchantRecoveryTerms)
    .where(eq(merchantRecoveryTerms.affiliateId, affiliateId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(merchantRecoveryTerms)
    .values({ affiliateId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(merchantRecoveryTerms)
    .where(eq(merchantRecoveryTerms.affiliateId, affiliateId))
    .limit(1);
  return again ?? null;
}

export type RecoveryProposal = {
  id: string;
  affiliateId: string;
  periodStart: Date;
  periodEnd: Date;
  grossGenerated: number;
  proposedRate: number;
  proposedAmount: number;
  outstandingBefore: number;
  outstandingAfter: number;
  availableBefore: number;
  availableAfter: number;
  coverageBefore: number | null;
  coverageAfter: number | null;
  status: string;
  createdAt: Date;
};

/** Crea una propuesta para el ciclo. No aplica nada. */
export async function proposeRecovery(
  db: Db,
  {
    affiliateId,
    periodStart,
    periodEnd,
    grossGenerated,
    now = new Date(),
  }: {
    affiliateId: string;
    periodStart: Date;
    periodEnd: Date;
    grossGenerated: number;
    now?: Date;
  }
): Promise<RecoveryProposal | null> {
  const [account] = await db
    .select()
    .from(merchantCapacityAccounts)
    .where(eq(merchantCapacityAccounts.affiliateId, affiliateId))
    .limit(1);
  if (!account || account.sandbox) return null;
  if (!["ACTIVE", "AUTHORIZED"].includes(String(account.status))) return null;

  const outstanding = Math.max(0, Number(account.creditOutstanding) || 0);
  const available = Math.max(0, Number(account.available) || 0);
  const gross = Math.max(0, Number(grossGenerated) || 0);
  if (outstanding <= 0 || gross <= 0 || available <= 0) return null;

  const terms = (await getOrCreateTerms(db, affiliateId)) ?? {};
  const targetMonths = Number(terms.targetMonths) || 18;
  const minCoverageDays = Number(terms.minCoverageDays) || 7;
  const rateMin = Number(terms.rateMin) || 0.2;
  const rateMax = Number(terms.rateMax) || 0.6;
  const coverageDays = Number(account.coverageDays) || minCoverageDays;
  const repaidRatio =
    Number(account.creditDisbursed) > 0
      ? Math.min(1, Number(account.creditRepaid) / Number(account.creditDisbursed))
      : 0;

  const rate = computeRecoveryRate({
    outstanding,
    expectedMonthlyGenerated: gross,
    coverageDays,
    targetMonths,
    minCoverageDays,
    rateMin,
    rateMax,
    repaidRatio,
  });
  const amount = round2(Math.min(gross * rate, outstanding, available));
  if (!(amount > 0)) return null;

  const availableAfter = round2(Math.max(0, available - amount));
  const coverageAfter =
    available > 0 ? round2(coverageDays * (availableAfter / available)) : coverageDays;

  const id = `rec-${affiliateId}-${periodEnd.toISOString().slice(0, 10)}`;
  const row = {
    id,
    affiliateId,
    periodStart,
    periodEnd,
    grossGenerated: round2(gross),
    proposedRate: rate,
    proposedAmount: amount,
    outstandingBefore: round2(outstanding),
    outstandingAfter: round2(Math.max(0, outstanding - amount)),
    availableBefore: round2(available),
    availableAfter,
    coverageBefore: coverageDays,
    coverageAfter,
    status: "PENDING",
    createdAt: now,
  };

  const [created] = await db
    .insert(merchantRecoveryProposals)
    .values(row)
    .onConflictDoNothing()
    .returning();
  if (!created) return null;

  await db.insert(merchantCapacityEvents).values({
    id: `mce-recovery-proposed-${id}`,
    affiliateId,
    type: "RECOVERY_PROPOSED",
    actor: "system",
    amount,
    metadata: { proposalId: id, rate, gross, outstanding, available },
  }).onConflictDoNothing();

  return created as RecoveryProposal;
}

export type AcceptResult = {
  ok: boolean;
  applied: boolean;
  status?: string;
  error?: string;
};

/** Acepta una propuesta. Solo aplica saldos en dual/enforce. */
export async function acceptRecoveryProposal(
  db: Db,
  {
    id,
    affiliateId,
    actor,
    evidence,
    at = new Date(),
  }: {
    id: string;
    affiliateId: string;
    actor: string;
    evidence?: Record<string, unknown>;
    at?: Date;
  }
): Promise<AcceptResult> {
  return await db.transaction(async (tx: Db) => {
    const [proposal] = await tx
      .select()
      .from(merchantRecoveryProposals)
      .where(
        and(
          eq(merchantRecoveryProposals.id, id),
          eq(merchantRecoveryProposals.affiliateId, affiliateId)
        )
      )
      .for("update");
    if (!proposal) return { ok: false, applied: false, error: "Propuesta no encontrada" };
    if (proposal.status !== "PENDING") {
      return { ok: false, applied: false, status: proposal.status, error: `Propuesta ${proposal.status}` };
    }

    const expiresAt = new Date(new Date(proposal.createdAt).getTime() + 15 * 86_400_000);
    if (at > expiresAt) {
      await tx
        .update(merchantRecoveryProposals)
        .set({ status: "EXPIRED" })
        .where(eq(merchantRecoveryProposals.id, id));
      return { ok: false, applied: false, error: "Propuesta expirada" };
    }

    const mode = mcceMode();
    const apply = mode === "dual" || mode === "enforce";
    const amount = Number(proposal.proposedAmount) || 0;

    if (apply) {
      const [account] = await tx
        .select()
        .from(merchantCapacityAccounts)
        .where(eq(merchantCapacityAccounts.affiliateId, affiliateId))
        .for("update");
      if (!account) return { ok: false, applied: false, error: "Cuenta de capacidad no encontrada" };
      if (Number(account.available) + EPS < amount) {
        return { ok: false, applied: false, error: "Capacidad disponible insuficiente" };
      }
      const newProvisioned = round2(Math.max(0, Number(account.provisioned) - amount));
      const newAvailable = round2(Math.max(0, Number(account.available) - amount));
      const newOutstanding = round2(Math.max(0, Number(account.creditOutstanding) - amount));
      const newRepaid = round2(Number(account.creditRepaid) + amount);

      await tx
        .update(merchantCapacityAccounts)
        .set({
          provisioned: newProvisioned,
          available: newAvailable,
          creditOutstanding: newOutstanding,
          creditRepaid: newRepaid,
          updatedAt: at,
        })
        .where(eq(merchantCapacityAccounts.affiliateId, affiliateId));

      await tx
        .update(ownedBusinesses)
        .set({ bunzBalance: newAvailable })
        .where(eq(ownedBusinesses.id, affiliateId));

      await tx
        .insert(merchantCapacityEvents)
        .values({
          id: `mce-recovery-applied-${id}`,
          affiliateId,
          type: "RECOVERY_APPLIED",
          actor,
          amount,
          metadata: { proposalId: id, mode, outstandingAfter: newOutstanding, availableAfter: newAvailable },
        })
        .onConflictDoNothing();
    } else {
      await tx
        .insert(merchantCapacityEvents)
        .values({
          id: `mce-recovery-accepted-${id}`,
          affiliateId,
          type: "RECOVERY_ACCEPTED",
          actor,
          amount,
          metadata: { proposalId: id, mode, shadow: true },
        })
        .onConflictDoNothing();
    }

    await tx
      .update(merchantRecoveryProposals)
      .set({
        status: apply ? "APPLIED" : "ACCEPTED",
        acceptedAt: at,
        acceptedBy: actor,
        evidence: evidence ?? {},
      })
      .where(eq(merchantRecoveryProposals.id, id));

    return { ok: true, applied: apply, status: apply ? "APPLIED" : "ACCEPTED" };
  });
}

export async function rejectRecoveryProposal(
  db: Db,
  { id, affiliateId, actor, at = new Date() }: { id: string; affiliateId: string; actor: string; at?: Date }
): Promise<{ ok: boolean; error?: string }> {
  const [proposal] = await db
    .select()
    .from(merchantRecoveryProposals)
    .where(and(eq(merchantRecoveryProposals.id, id), eq(merchantRecoveryProposals.affiliateId, affiliateId)))
    .limit(1);
  if (!proposal) return { ok: false, error: "Propuesta no encontrada" };
  if (proposal.status !== "PENDING") return { ok: false, error: `Propuesta ${proposal.status}` };

  await db
    .update(merchantRecoveryProposals)
    .set({ status: "REJECTED", acceptedAt: at, acceptedBy: actor, evidence: { rejected: true } })
    .where(eq(merchantRecoveryProposals.id, id));

  await db.insert(merchantCapacityEvents).values({
    id: `mce-recovery-rejected-${id}`,
    affiliateId,
    type: "RECOVERY_REJECTED",
    actor,
    amount: 0,
    metadata: { proposalId: id },
  }).onConflictDoNothing();

  return { ok: true };
}

export async function listRecoveryProposals(db: Db, affiliateId: string, limit = 20) {
  return await db
    .select()
    .from(merchantRecoveryProposals)
    .where(eq(merchantRecoveryProposals.affiliateId, affiliateId))
    .orderBy(desc(merchantRecoveryProposals.createdAt))
    .limit(limit);
}

/** Suma la capacidad bruta generada en el periodo (eventos de actividad). */
export async function sumPeriodGross(
  db: Db,
  affiliateId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(coalesce(nullif(metadata->>'gross', '')::numeric, ${merchantCapacityEvents.amount})), 0)`,
    })
    .from(merchantCapacityEvents)
    .where(
      and(
        eq(merchantCapacityEvents.affiliateId, affiliateId),
        eq(merchantCapacityEvents.type, "ACTIVITY_RECOGNIZED"),
        gte(merchantCapacityEvents.createdAt, periodStart),
        lt(merchantCapacityEvents.createdAt, periodEnd)
      )
    );
  return Math.max(0, Number(row?.total) || 0);
}

/** Marca como expiradas las propuestas pendientes fuera de plazo. */
export async function expireStaleProposals(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 15 * 86_400_000);
  const expired = await db
    .update(merchantRecoveryProposals)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(merchantRecoveryProposals.status, "PENDING"),
        lt(merchantRecoveryProposals.createdAt, cutoff)
      )
    )
    .returning({ id: merchantRecoveryProposals.id });
  return expired.length;
}

export type CycleProposalResult = {
  affiliateId: string;
  businessName?: string;
  ownerId?: string | null;
  ownerEmail?: string | null;
  gross: number;
  proposal: RecoveryProposal | null;
  skipped?: string;
};

/**
 * Cierra el ciclo de un afiliado: calcula la base generada del periodo y crea
 * la propuesta. No aplica retenciones.
 */
export async function proposeRecoveryForAffiliate(
  db: Db,
  {
    affiliateId,
    periodStart,
    periodEnd,
    now = new Date(),
  }: { affiliateId: string; periodStart: Date; periodEnd: Date; now?: Date }
): Promise<CycleProposalResult> {
  const [business] = await db
    .select({
      name: ownedBusinesses.name,
      ownerId: ownedBusinesses.ownerId,
      ownerEmail: users.email,
      sandbox: ownedBusinesses.sandbox,
    })
    .from(ownedBusinesses)
    .leftJoin(users, eq(users.id, ownedBusinesses.ownerId))
    .where(eq(ownedBusinesses.id, affiliateId))
    .limit(1);

  if (!business || business.sandbox) {
    return { affiliateId, gross: 0, proposal: null, skipped: "sandbox" };
  }

  const gross = await sumPeriodGross(db, affiliateId, periodStart, periodEnd);
  if (!(gross > 0)) {
    return { affiliateId, businessName: business.name, gross, proposal: null, skipped: "no-activity" };
  }

  const proposal = await proposeRecovery(db, {
    affiliateId,
    periodStart,
    periodEnd,
    grossGenerated: gross,
    now,
  });

  return {
    affiliateId,
    businessName: business.name,
    ownerId: business.ownerId,
    ownerEmail: business.ownerEmail,
    gross,
    proposal,
    skipped: proposal ? undefined : "not-eligible",
  };
}

/** Afiliados con cuenta activa y compromiso pendiente (candidatos a propuesta). */
export async function listRecoveryCandidates(db: Db) {
  return await db
    .select({
      affiliateId: merchantCapacityAccounts.affiliateId,
      creditOutstanding: merchantCapacityAccounts.creditOutstanding,
      available: merchantCapacityAccounts.available,
      sandbox: merchantCapacityAccounts.sandbox,
    })
    .from(merchantCapacityAccounts)
    .where(
      and(
        inArray(merchantCapacityAccounts.status, ["ACTIVE", "AUTHORIZED"]),
        eq(merchantCapacityAccounts.sandbox, false)
      )
    );
}
